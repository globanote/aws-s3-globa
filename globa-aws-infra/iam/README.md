# Lambda 실행 역할에 대한 IAM 신뢰 정책
- **Version**: `2012-10-17`  
  IAM 정책 포맷 버전
- **Effect**: `Allow`  
  동작 허용
- **Principal**: `lambda.amazonaws.com`  
  AWS Lambda 서비스가 이 Role을 사용할 수 있도록 지정
- **Action**: `sts:AssumeRole`  
  Lambda가 이 Role을 가정하여 권한을 획득할 수 있게 함