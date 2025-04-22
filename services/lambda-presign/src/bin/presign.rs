use lambda_runtime::{service_fn, Error, LambdaEvent};
use aws_lambda_events::event::apigw::{ApiGatewayV2httpRequest as Request, ApiGatewayV2httpResponse as Response};
use aws_lambda_events::encodings::Body;
use http::HeaderMap;
use serde::{Deserialize, Serialize};
use serde_json::json;
use aws_sdk_s3::{Client as S3Client, presigning::PresigningConfig};
use tracing::{info, error};
use tracing_subscriber::{fmt, EnvFilter};
use std::time::Duration;

// 요청 바디 구조
#[derive(Deserialize)]
struct PresignRequest {
    bucket: String,
    key: String,
    content_type: String,
}

// 응답 바디 구조
#[derive(Serialize)]
struct PresignResponse {
    url: String,
}

#[tokio::main]
async fn main() -> Result<(), Error> {
    // 환경변수 RUST_LOG에 따라 로그 레벨 설정 (없으면 info)
    fmt()
        .with_env_filter(EnvFilter::new("info"))
        .init();
    info!("Lambda starting");
    lambda_runtime::run(service_fn(handler)).await?;
    Ok(())
}

async fn handler(event: LambdaEvent<Request>) -> Result<Response, Error> {
    let (req, _ctx) = event.into_parts();
    info!("▶▶ raw event: {:?}", req);

    // 요청 본문 파싱
    let body_str = req.body
        .as_deref()
        .ok_or_else(|| {
            error!("Missing body");
            "Missing body"
        })?;
    info!("Parsed body: {}", body_str);

    let pres: PresignRequest = serde_json::from_str(body_str).map_err(|e| {
        error!("JSON parse error: {:?}", e);
        e
    })?;

    // AWS SDK 구성 및 S3 presign
    // load_from_env 사용 (behavior-version-latest feature 필요)
    let config = aws_config::load_from_env().await;
    let client = S3Client::new(&config);
    let presign_cfg = PresigningConfig::builder()
        .expires_in(Duration::from_secs(900))
        .build()?;

    let presigned = client
        .put_object()
        .bucket(&pres.bucket)
        .key(&pres.key)
        .content_type(&pres.content_type)
        .presigned(presign_cfg)
        .await
        .map_err(|e| {
            error!("Presign failed: {:?}", e);
            e
        })?;
    info!("Generated URL: {}", presigned.uri());

    // 응답 구성
    let resp_body = json!(PresignResponse { url: presigned.uri().to_string() }).to_string();
    let mut headers = HeaderMap::new();
    headers.insert("content-type", "application/json".parse().unwrap());

    Ok(Response {
        status_code: 200,
        headers,
        multi_value_headers: HeaderMap::new(),
        body: Some(Body::Text(resp_body)),
        is_base64_encoded: false,
        cookies: Vec::new(),
    })
}
