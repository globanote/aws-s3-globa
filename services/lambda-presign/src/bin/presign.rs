use lambda_runtime::{run, service_fn, Error, LambdaEvent};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use aws_sdk_s3::{Client as S3Client, presigning::PresigningConfig};
use tracing::{info, error};
use tracing_subscriber::{fmt, EnvFilter};
use std::time::Duration;

#[derive(Deserialize)]
struct PresignRequest {
    bucket: String,
    key: String,
    content_type: String,
    user_id: String,
}

#[derive(Serialize)]
struct PresignResponse {
    url: String,
}

#[tokio::main]
async fn main() -> Result<(), Error> {
    fmt().with_env_filter(EnvFilter::new("info")).init();
    info!("Starting presign lambda");
    run(service_fn(handler)).await
}

async fn handler(event: LambdaEvent<Value>) -> Result<Value, Error> {
    let (event, _context) = event.into_parts();
    info!("받은 이벤트: {}", json!(event));
    
    // API Gateway 이벤트에서 본문 추출
    let body = if let Some(body) = event.get("body") {
        if let Some(body_str) = body.as_str() {
            body_str
        } else {
            return Ok(json!({
                "statusCode": 400,
                "body": "요청 본문이 문자열이 아닙니다"
            }));
        }
    } else {
        return Ok(json!({
            "statusCode": 400,
            "body": "요청 본문이 없습니다"
        }));
    };
    
    // JSON 파싱
    let pres: PresignRequest = match serde_json::from_str(body) {
        Ok(req) => req,
        Err(e) => {
            error!("JSON 파싱 오류: {:?}", e);
            return Ok(json!({
                "statusCode": 400,
                "body": format!("잘못된 JSON 형식: {}", e)
            }));
        }
    };
    
    // S3 presign + 사용자별 키 설정
    let user_key= format!("users/{}/recordings/{}", pres.user_id, pres.key);
    let conf = aws_config::load_from_env().await;
    let client = S3Client::new(&conf);
    let presign_cfg = match PresigningConfig::builder()
        .expires_in(Duration::from_secs(900))
        .build() {
            Ok(cfg) => cfg,
            Err(e) => {
                error!("PresigningConfig 생성 오류: {:?}", e);
                return Ok(json!({
                    "statusCode": 500,
                    "body": "서버 내부 오류"
                }));
            }
        };
    
    let presigned = match client
        .put_object()
        .bucket(&pres.bucket)
        .key(&user_key)
        .content_type(&pres.content_type)
        .presigned(presign_cfg)
        .await {
            Ok(url) => url,
            Err(e) => {
                error!("Presign 실패: {:?}", e);
                return Ok(json!({
                    "statusCode": 500,
                    "body": format!("Presign URL 생성 실패: {}", e)
                }));
            }
        };
    
    let response = json!(PresignResponse { url: presigned.uri().to_string() });
    
    Ok(json!({
        "statusCode": 200,
        "headers": {
            "content-type": "application/json"
        },
        "body": response.to_string()
    }))
}