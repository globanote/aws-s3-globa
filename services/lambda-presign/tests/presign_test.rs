// src/tests/presign_test.rs
#[cfg(test)]
mod tests {
    use super::*;
    use aws_sdk_s3::presigning::config::PresigningConfig;
    use std::time::Duration;

    #[tokio::test]
    async fn test_presign_config_duration() {
        // Test
        let cfg = PresigningConfig::builder().expires_in(Duration::from_secs(60)).build().unwrap();
        assert_eq!(cfg.expires_in(), Duration::from_secs(60));
    }
}
