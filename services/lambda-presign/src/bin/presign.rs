use lambda_runtime::{service_fn, Error, LambdaEvent};
use aws_lambda_events::apigw::{ApiGatewayProxyRequest, ApiGatewayProxyResponse};
use aws_lambda_events::encodings::Body;
use aws_sdk_s3::Client as S3Client;
use aws_sdk_s3::presigning::PresigningConfig;
use serde::{Deserialize, Serialize};
use serde_json;

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

async fn handler(
    event: LambdaEvent<ApiGatewayProxyRequest>,
) -> Result<ApiGatewayProxyResponse, Error> {
    println!("▶▶ handler start, body = {:?}", event.payload.body);
    // Parse request body
    let body_str = event.payload.body.as_deref().unwrap_or("{}");
    let req: PresignRequest = serde_json::from_str(body_str)?;

    // Load AWS config and create S3 client
    let config = aws_config::load_from_env().await;
    let client = S3Client::new(&config);

    // Build presign config
    let presign_cfg = PresigningConfig::builder()
        .expires_in(std::time::Duration::from_secs(900))
        .build()?;

    // Generate presigned URL for PUT
    let presigned = client
        .put_object()
        .bucket(req.bucket)
        .key(req.key)
        .content_type(req.content_type)
        .presigned(presign_cfg)
        .await?;

    // Serialize response
    let response = PresignResponse { url: presigned.uri().to_string() };
    let response_json = serde_json::to_string(&response)?;

    // Return API Gateway proxy response
    let api_response = ApiGatewayProxyResponse {
        status_code: 200,
        headers: Default::default(),
        multi_value_headers: Default::default(),
        body: Some(Body::Text(response_json)),
        is_base64_encoded: false,
    };

    Ok(api_response)
}

#[tokio::main]
async fn main() -> Result<(), Error> {
    lambda_runtime::run(service_fn(handler)).await?;
    Ok(())
}
