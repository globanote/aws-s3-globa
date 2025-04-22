use lambda_runtime::{service_fn, Error, LambdaEvent};
use aws_lambda_events::event::apigw::{
    ApiGatewayV2httpRequest as Request,
    ApiGatewayV2httpResponse as Response,
};
use serde::{Deserialize, Serialize};
use serde_json::json;
use aws_sdk_s3::{Client as S3Client, presigning::PresigningConfig};
use tracing::{info, error};
use tracing_subscriber::{fmt, EnvFilter};
use std::collections::HashMap;

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

    // HTTP API(v2)의 body: Option<String>
    let body_str = req.body
        .as_deref()
        .ok_or_else(|| {
            error!("Missing body");
            "Missing body"
        })?;
    info!("Parsed body: {}", body_str);

    // JSON 파싱
    let pres: PresignRequest = serde_json::from_str(body_str).map_err(|e| {
        error!("JSON parse error: {:?}", e);
        e
    })?;

    // S3 presign
    let conf = aws_config::load_from_env().await;
    let client = S3Client::new(&conf);
    let presign_cfg = PresigningConfig::builder()
        .expires_in(std::time::Duration::from_secs(900))
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

    let body = json!(PresignResponse { url: presigned.uri().to_string() }).to_string();
    let mut headers = HashMap::new();
    headers.insert("Content-Type".to_string(), "application/json".to_string());

    Ok(Response {
        status_code: 200,
        headers,
        multi_value_headers: Default::default(),
        body: Some(body),
        is_base64_encoded: Some(false),
    })
}
