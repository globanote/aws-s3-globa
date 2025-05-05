// src/services/apiService.js
// 개발 환경에서는 상대 경로 사용 (프록시를 통해 요청)
const API_MEETING_MANAGER_URL = process.env.REACT_APP_API_MEETING_MANAGER_URL;
const API_MEETING_MANAGER_KEY = process.env.REACT_APP_API_MEETING_MANAGER_KEY;
// 사용량 정보 가져오기
const API_USER_QUOTA_URL = process.env.REACT_APP_API_USER_QUOTA_URL;
const API_USER_QUOTA_KEY= process.env.REACT_APP_API_USER_QUOTA_KEY;

// 응답 처리 헬퍼 함수
const handleResponse = async (response) => {
  // 응답 상태 로깅
  console.log('응답 상태:', response.status);
  
  // 응답이 JSON이 아닌 경우 처리
  const contentType = response.headers.get('content-type');
  if (!contentType || !contentType.includes('application/json')) {
    const text = await response.text();
    console.error('JSON이 아닌 응답 수신:', text.substring(0, 200));
    throw new Error('API가 유효한 JSON 응답을 반환하지 않았습니다');
  }

  // 상태 코드가 2xx가 아닌 경우
  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.message || `API 오류: ${response.status}`);
  }

  return await response.json();
};

// 미팅관리 목록 조회 API
export const fetchMeetings = async (token) => {
  try {
    console.log('미팅 목록 조회 요청 전송:', `${API_MEETING_MANAGER_URL}/meetings`);
    
    const response = await fetch(`${API_MEETING_MANAGER_URL}/meetings`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        'x-api-key': API_MEETING_MANAGER_KEY
      }
    });
    
    return await handleResponse(response);
  } catch (error) {
    console.error('미팅 목록 조회 오류:', error);
    throw error;
  }
};

// 미팅관리 생성 API
export const createMeeting = async (token, meetingData) => {
  try {
    console.log('미팅 생성 요청 전송:', `${API_MEETING_MANAGER_URL}/meetings`);
    console.log('미팅 데이터:', meetingData);
    
    const response = await fetch(`${API_MEETING_MANAGER_URL}/meetings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        'x-api-key': API_MEETING_MANAGER_KEY
      },
      body: JSON.stringify(meetingData)
    });
    
    return await handleResponse(response);
  } catch (error) {
    console.error('미팅 생성 오류:', error);
    throw error;
  }
};

// 미팅 수정 API
export const updateMeeting = async (token, meetingId, meetingData) => {
  try {
    console.log('미팅 수정 요청 전송:', `${API_MEETING_MANAGER_URL}/meetings/${meetingId}`);
    console.log('미팅 데이터:', meetingData);
    
    const response = await fetch(`${API_MEETING_MANAGER_URL}/meetings/${meetingId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        'x-api-key': API_MEETING_MANAGER_KEY
      },
      body: JSON.stringify(meetingData)
    });
    
    return await handleResponse(response);
  } catch (error) {
    console.error('미팅 수정 오류:', error);
    throw error;
  }
};

// 미팅 삭제 API
export const deleteMeeting = async (token, meetingId) => {
  try {
    console.log('미팅 삭제 요청 전송:', `${API_MEETING_MANAGER_URL}/meetings/${meetingId}`);
    
    const response = await fetch(`${API_MEETING_MANAGER_URL}/meetings/${meetingId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`,
        'x-api-key': API_MEETING_MANAGER_KEY
      }
    });
    
    return await handleResponse(response);
  } catch (error) {
    console.error('미팅 삭제 오류:', error);
    throw error;
  }
};

// 사용자 할당량 조회 API[05.03]
export const fetchUserQuota = async (token, userId) => {
  try {
    console.log('사용자 할당량 조회 요청 전송:', `${API_USER_QUOTA_URL}/user/quota`);
    
    // URL에 userId를 쿼리 파라미터로 추가 (필요한 경우)
    const url = userId 
      ? `${API_USER_QUOTA_URL}/user/quota?userId=${userId}`
      : `${API_USER_QUOTA_URL}/user/quota`;
    
    // 개발 환경에서는 CORS 오류가 발생할 수 있으므로 더미 데이터 반환
    if (process.env.NODE_ENV === 'development' && API_USER_QUOTA_KEY === '') {
      console.log('개발 환경에서는 할당량 API 호출을 건너뜁니다.');
      return {
        quota: {
          maxMeetings: 10,
          usedMeetings: 5,
          remaining: 5
        }
      };
    }
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        'x-api-key': API_USER_QUOTA_KEY
      }
    });
    
    return await handleResponse(response);
  } catch (error) {
    console.error('사용자 할당량 조회 오류:', error);
    // 오류 발생 시 기본값 반환
    return {
      quota: {
        maxMeetings: 10,
        usedMeetings: 0,
        remaining: 10
      }
    };
  }
};