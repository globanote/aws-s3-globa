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

    // 바디가 비어 있으면 400 리턴
    let raw = req.body();
    if raw.is_empty() {
        error!("Empty body");
        return Ok(Response::builder().status(400).body("missing body".into())?);
    }

    // JSON 파싱
    let pres: PresignRequest = serde_json::from_slice(raw).map_err(|e| {
        error!("JSON parse error: {:?}", e);
        e.into()
    })?;

    // S3 presign
    let conf = aws_config::load_from_env().await;
    let client = S3Client::new(&conf);
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
            e.into()
        })?;

    let body = json!(PresignResponse { url: presigned.uri().to_string() }).to_string();
    Ok(Response::builder()
        .status(200)
        .header("content-type", "application/json")
        .body(body.into())?)
}
