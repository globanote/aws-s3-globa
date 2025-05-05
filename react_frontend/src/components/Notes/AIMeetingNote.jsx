import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import '../../styles/notes.css';
import { useAuth } from 'react-oidc-context';

function AIMeetingNote() {
  const auth = useAuth();
  const navigate = useNavigate();
  const [viewMode, setViewMode] = useState('transcript');
  const [summaryType, setSummaryType] = useState('one_page_summary');
  const [meetingHistory, setMeetingHistory] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentTranscript, setCurrentTranscript] = useState({
    title: '',
    meetingDate: '',
    content: '' // formattedText 저장
  });
  const [loading, setLoading] = useState(false);

  const [currentSummary, setCurrentSummary] = useState({
    title: '',
    meetingDate: '',
    content: ''
  });

  const [isSummaryLoading, setIsSummaryLoading] = useState(false);

  const idToken = auth.user?.id_token || auth.user?.idToken || '';
  const userId = auth.user?.profile?.sub || 'guest-user';
  console.log(userId);

  useEffect(() => {
    if (!idToken) return;
    setLoading(true);

    console.log('API 호출 시작:', userId);

    fetch(`https://e8477gmw63.execute-api.ap-northeast-2.amazonaws.com/prod/meeting-history?user_id=${userId}`, {
      headers: {
        'Authorization': `Bearer ${idToken}`
      }
    })
      .then(res => {
        console.log('API 응답 상태:', res.status);
        return res.json();
      })
      .then(data => {
        console.log('API 응답 데이터:', data);
        console.log('meetings 배열:', data.meetings);
        setMeetingHistory(Array.isArray(data.meetings) ? data.meetings : []);
        setLoading(false);
      })
      .catch((error) => {
        console.error('API 오류:', error);
        setMeetingHistory([]);
        setLoading(false);
      });
  }, [idToken, userId]);

  // 여기서 filteredMeetings를 선언!
  const filteredMeetings = meetingHistory.filter(
    meeting =>
      (meeting.title || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (meeting.meeting_date || '').includes(searchTerm)
  );

  // 렌더링 시 meetingHistory 상태 확인
  useEffect(() => {
    console.log('현재 meetingHistory:', meetingHistory);
    console.log('필터링된 meetings:', filteredMeetings);
  }, [meetingHistory, filteredMeetings]);


  const handleExport = () => {
    if (viewMode === 'transcript') {
      // 트랜스크립트 내보내기
      const content = currentTranscript.content
        ? currentTranscript.content.split('\n').join('\n')
        : '내보낼 내용이 없습니다';

      const blob = new Blob([content], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `회의록_${currentTranscript.title || '트랜스크립트'}.txt`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } else {
      // 요약 내용 내보내기
      const content = currentSummary.content
        ? currentSummary.content.split('\n').join('\n')
        : '내보낼 요약 내용이 없습니다';

      const blob = new Blob([content], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `회의록_요약_${currentSummary.title || ''}.txt`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
  };


  const handleMeetingClick = async (meeting) => {
    try {
      const response = await fetch(
        `https://jv4jxsz3fa.execute-api.ap-northeast-2.amazonaws.com/prod/get-transcript?title=${encodeURIComponent(meeting.title)}&date=${encodeURIComponent(meeting.meeting_date)}`,
        { headers: { Authorization: `Bearer ${idToken}` } }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || '트랜스크립트 조회 실패');
      }

      const { formattedText, title, meetingDate } = await response.json();
      setCurrentTranscript({
        title,
        meetingDate,
        content: formattedText || '트랜스크립트 내용 없음'
      });


    } catch (error) {
      console.error('트랜스크립트 조회 실패:', error);
      alert(error.message);
    }
  };


  const handleGenerateSummary = async () => {
    try {
      setIsSummaryLoading(true);
      const response = await fetch(
        'https://pw71rp1xc9.execute-api.ap-northeast-2.amazonaws.com/prod/transcript-summarize',
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${idToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            title: currentTranscript.title,
            date: currentTranscript.meetingDate,
            summary_type: summaryType // 직접 타입값 전송
          })
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || '요약 생성 실패');
      }

      const { summary } = await response.json();
      setCurrentSummary({
        title: currentTranscript.title,
        meetingDate: currentTranscript.meetingDate,
        content: summary
      });
    } catch (error) {
      console.error('요약 생성 오류:', error);
      alert(error.message);
    } finally {
      setIsSummaryLoading(false);
    }
  };


  return (
    <div className="ai-meetingnote-root">
      {/* 중앙: 미팅 히스토리 */}
      <section className="ai-history-section">
        <div className="ai-history-title">MEETING HISTORY</div>
        <input
          className="ai-history-search"
          type="text"
          placeholder="Search meetings..."
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
        />
        {loading ? (
          <div className="ai-history-loading" style={{ textAlign: 'center', margin: '2em 0' }}>불러오는 중...</div>
        ) : filteredMeetings.length === 0 ? (
          <div style={{ textAlign: 'center', margin: '2em 0' }}>
            {searchTerm ? ( // 검색어가 있는 경우
              <div>검색된 회의가 없습니다</div>
            ) : ( // 검색어가 없는 경우
              <>
                <div>회의 기록이 없습니다.</div>
                <button
                  className="main-btn"
                  style={{ marginTop: '1em' }}
                  onClick={() => navigate('/global-note-create')}
                >
                  글로바노트 생성
                </button>
              </>
            )}
          </div>
        ) : (
          <ul className="ai-history-list">
            {filteredMeetings.map(meeting => (
              <li
                key={meeting.meeting_num}
                className="ai-history-item"
                onClick={() => handleMeetingClick(meeting)}
              >
                <div className="ai-history-item-title">{meeting.title}</div>
                <div className="ai-history-item-date">{meeting.meeting_date}</div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <main className="ai-note-section">
        <div className="ai-note-header">
          <div className="ai-note-tabs">
            <button
              className={`ai-note-tab ${viewMode === 'transcript' ? 'active' : ''}`}
              onClick={() => setViewMode('transcript')}
            >
              전체 트랜스크립션
            </button>
            <button
              className={`ai-note-tab ${viewMode === 'summary' ? 'active' : ''}`}
              onClick={() => setViewMode('summary')}
            >
              AI 회의록 요약
            </button>
          </div>
          <div className="ai-note-actions">
            <button className="ai-export-btn" onClick={handleExport}>내보내기</button>
          </div>
        </div>
        <div className="ai-note-body">
          {viewMode === 'transcript' ? (
            <div className="ai-transcript-view">
              <div className="ai-note-title">{currentTranscript.title || '회의 스크립트'}</div>
              <div className="ai-note-date">{currentTranscript.meetingDate || ''}</div>
              <div className="ai-transcript-list">
                <div className="ai-transcript-content">
                  {currentTranscript.content
                    ? currentTranscript.content.split('\n').map((line, idx) => (
                      <div key={idx} className="transcript-line">
                        {line}
                      </div>
                    ))
                    : (
                      <div className="ai-transcript-placeholder">
                        회의를 선택하면 트랜스크립션이 표시됩니다
                      </div>
                    )
                  }
                </div>
              </div>
            </div>
          ) : (
            <div className="ai-summary-view">
              <div className="ai-note-header-row">
                <div className="ai-note-title-row">
                  <div className="ai-note-title">{currentTranscript.title + ' 요약' || 'AI 회의록 요약'}</div>
                  <div className="ai-note-date">{currentSummary.meetingDate || ''}</div>
                </div>
                
                <div className="ai-summary-controls">
                  <div className="ai-summary-type-row">
                    <label htmlFor="summaryType" className="ai-summary-type-label">회의 유형:</label>
                    <select
                      id="summaryType"
                      className="ai-summary-type-select"
                      value={summaryType}
                      onChange={e => setSummaryType(e.target.value)}
                    >
                      <option value="one_page_summary">한페이지 요약</option>
                      <option value="lecture_note">강의노트</option>
                      <option value="IR">IR/피칭</option>
                      <option value="general_stockholders_meeting">주주총회</option>
                      <option value="sales_meeting">세일즈 미팅</option>
                      <option value="job_interview">채용 인터뷰</option>
                      <option value="user_interview">유저 인터뷰</option>
                      <option value="oneandone_meeting">원앤원 미팅</option>
                    </select>
                  </div>
                  <button
                    className="ai-generate-btn"
                    onClick={handleGenerateSummary}
                    disabled={isSummaryLoading || !currentTranscript.content}
                  >
                    {isSummaryLoading ? '요약 생성 중...' : '요약 생성하기'}
                  </button>
                </div>
              </div>

              <div className="ai-summary-content">
                {currentSummary.content ? (
                  currentSummary.content.split('\n').map((line, idx) => (
                    <div key={idx} className="summary-line">{line}</div>
                  ))
                ) : (
                  <div className="ai-summary-placeholder">
                    {currentTranscript.content
                      ? '위 회의 유형을 선택하고 요약 생성하기 버튼을 클릭하세요'
                      : '먼저 좌측 History에서 요약할 회의를 선택해주세요'}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

export default AIMeetingNote;
