use lambda_http::{run, service_fn, Body, Error, Request, Response};
use serde::{Deserialize, Serialize};
use serde_json::json;
use aws_sdk_s3::{Client as S3Client, presigning::PresigningConfig};
use tracing::{info, error};
use tracing_subscriber::{fmt, EnvFilter};
use std::time::Duration;

#[derive(Deserialize)]
struct PresignRequest {
    bucket: String,
    key: String,
    content_type: String,
}

#[derive(Serialize)]
struct PresignResponse {
    url: String,
}

#[tokio::main]
async fn main() -> Result<(), Error> {
    // 로그 초기화
    fmt().with_env_filter(EnvFilter::new("info")).init();
    info!("Starting presign lambda");
    run(service_fn(handler)).await
}

async fn handler(req: Request) -> Result<Response<Body>, Error> {
    info!("▶▶ raw event: {:?}", req);

    // API Gateway에서 오는 요청 본문 추출
    let body = match req.body() {
        Body::Text(text) => text.as_bytes(),
        Body::Binary(bin) => bin,
        Body::Empty => {
            error!("Empty body");
            return Ok(Response::builder().status(400).body("missing body".into())?);
        }
    };

    // JSON 파싱 - match로 오류 처리
    let pres: PresignRequest = match serde_json::from_slice(body) {
        Ok(parsed) => parsed,
        Err(e) => {
            error!("JSON parse error: {:?}", e);
            return Ok(Response::builder()
                .status(400)
                .body(format!("잘못된 JSON 형식: {}", e).into())?);
        }
    };

    // S3 presign
    let conf = aws_config::load_from_env().await;
    let client = S3Client::new(&conf);
    let presign_cfg = match PresigningConfig::builder()
        .expires_in(Duration::from_secs(900))
        .build() {
            Ok(cfg) => cfg,
            Err(e) => {
                error!("PresigningConfig 생성 오류: {:?}", e);
                return Ok(Response::builder()
                    .status(500)
                    .body("서버 내부 오류".into())?);
            }
        };

    // 명시적인 match로 오류 처리
    let presigned = match client
        .put_object()
        .bucket(&pres.bucket)
        .key(&pres.key)
        .content_type(&pres.content_type)
        .presigned(presign_cfg)
        .await {
            Ok(url) => url,
            Err(e) => {
                error!("Presign failed: {:?}", e);
                return Ok(Response::builder()
                    .status(500)
                    .body(format!("Presign URL 생성 실패: {}", e).into())?);
            }
        };

    let body = json!(PresignResponse { url: presigned.uri().to_string() }).to_string();
    Ok(Response::builder()
        .status(200)
        .header("content-type", "application/json")
        .body(body.into())?)
}