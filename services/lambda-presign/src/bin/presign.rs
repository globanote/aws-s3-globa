use lambda_runtime::{handler_fn, Context, Error};
use aws_lambda_events::apigw::{ApiGatewayProxyRequest, ApiGatewayProxyResponse};
use aws_sdk_s3::{Client as S3Client, Region, presigning::config::PresigningConfig};
use serde::{Deserialize, Serialize};
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

async fn handler(
    evt: ApiGatewayProxyRequest,
    _: Context
) -> Result<ApiGatewayProxyResponse, Error> {
    // 1) 요청 바디 파싱
    let req: PresignRequest = serde_json::from_str(evt.body.as_deref().unwrap_or(""))?;

    // 2) S3 클라이언트 생성 (환경변수 AWS_REGION, 자격증명 사용)
    let config = aws_config::load_from_env().await;
    let s3 = S3Client::new(&config);

    // 3) Presigning 설정 (15분 유효)
    let presign_cfg = PresigningConfig::builder()
        .expires_in(Duration::from_secs(900))
        .build()?;

    // 4) 요청 객체 생성
    let presigned_req = s3
        .put_object()
        .bucket(&req.bucket)
        .key(&req.key)
        .content_type(&req.content_type)
        .presigned(presign_cfg)
        .await?;

    let url = presigned_req.uri().to_string();

    // 5) 응답 생성
    let resp = PresignResponse { url };
    let body = serde_json::to_string(&resp)?;
    Ok(ApiGatewayProxyResponse {
        status_code: 200,
        headers: Default::default(),
        multi_value_headers: Default::default(),
        body: Some(body),
        is_base64_encoded: Some(false),
    })
}

#[tokio::main]
async fn main() -> Result<(), Error> {
    let func = handler_fn(handler);
    lambda_runtime::run(func).await?;
    Ok(())
}
