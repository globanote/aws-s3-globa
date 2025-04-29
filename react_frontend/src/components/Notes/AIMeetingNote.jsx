import React, { useState } from 'react';
import '../../styles/notes.css';

function AIMeetingNote() {
  const [viewMode, setViewMode] = useState('transcript'); // 'transcript' or 'summary'
  const [summaryType, setSummaryType] = useState('bulleted'); // 'bulleted', 'narrative', 'action-items', etc.
  
  const meetingHistory = [
    { id: 1, title: '일간회의 (프로젝트 타임라인)', date: '2025-04-22' },
    { id: 2, title: '일간회의 (아키텍처 및 개발 계획 피드백)', date: '2025-04-21' },
    { id: 3, title: '일간회의', date: '2025-04-20' },
    { id: 4, title: 'Client Presentation', date: '2025-04-17' }
  ];
  
  const transcriptContent = [
    { time: '14:29', speaker: '김유리', content: '금리에 대한 회의 진행 및 최근의 트렌드와 이슈에 대한 논의가 있었습니다. 그와 관련된 의견들이 공유되었고, 글로벌 스탠더드와 현지화 전략이 화두였습니다.' },
    { time: '15:11', speaker: '박지연', content: '글로벌 스탠더드와 현지화 전략에 대해 논의. 사용자 경험 개선을 위한 스크라이빙 기능 논의.' },
    { time: '15:36', speaker: '김유리', content: '글로벌 스탠더드는 우리에게 약간의 거리가 있어 보입니다.' },
    { time: '16:27', speaker: '박지연', content: '스크라이빙 기능의 구체적인 구현 방안 논의.' }
  ];
  
  const summaryContent = {
    bulleted: {
      title: '주요 논의 사항',
      content: [
        '프로젝트 진행 일정',
        '금리 3.15% 적용에 대한 의견 논의',
        '글로벌 스탠더드와 현지화 전략 논의',
        '사용자 경험 개선을 위한 스크라이빙 기능 논의',
        '마케팅 페이지 다국어 지원 검토'
      ]
    },
    narrative: {
      title: '회의 요약',
      content: '이번 회의에서는 금리 정책과 글로벌화 전략에 관한 논의가 이루어졌습니다. 금리 3.15%의 적용에 대해 여러 의견이 제시되었으며, 개인과 사업자에게 동일한 규칙을 적용하는 방안이 제안되었습니다. 또한 글로벌 스탠더드 적용에 있어 우리 조직의 현실과 괴리가 있을 수 있다는 의견이 나왔으며, 사용자 경험 개선을 위한 스크라이빙 기능과 다국어 지원에 대한 논의도 진행되었습니다.'
    },
    actionItems: {
      title: '액션 아이템',
      content: [
        '금리 3.15% 적용에 대한 최종 결정 (담당: 김유리, 기한: 4/30)',
        '글로벌 스탠더드와 현지화 전략 문서 작성 (담당: 박지연, 기한: 5/5)',
        '스크라이빙 기능 구현 계획 수립 (담당: 개발팀, 기한: 5/10)',
        '마케팅 페이지 다국어 지원 방안 검토 (담당: 마케팅팀, 기한: 5/15)'
      ]
    }
  };

  return (
    <div className="ai-meetingnote-root">
      {/* 중앙: 미팅 히스토리 */}
      <section className="ai-history-section">
        <div className="ai-history-title">MEETING HISTORY</div>
        <input className="ai-history-search" type="text" placeholder="Search meetings..." />
        <ul className="ai-history-list">
          {meetingHistory.map(meeting => (
            <li key={meeting.id} className="ai-history-item">
              <div className="ai-history-item-title">{meeting.title}</div>
              <div className="ai-history-item-date">{meeting.date}</div>
            </li>
          ))}
        </ul>
      </section>

      {/* 우측: 회의 상세 */}
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
              AI 회의록 스타일 지정
            </button>
          </div>
          <div className="ai-note-actions">
            <button className="ai-export-btn">Export</button>
          </div>
        </div>
        <div className="ai-note-body">
          {viewMode === 'transcript' ? (
            <div className="ai-transcript-view">
              <div className="ai-note-title">일간회의 (프로젝트 타임라인)</div>
              <div className="ai-note-date">2025/04/22</div>
              <div className="ai-transcript-list">
                {transcriptContent.map((line, idx) => (
                  <div key={idx} className="ai-transcript-line">
                    <span className="ai-transcript-time">{line.time}</span>
                    <span className="ai-transcript-speaker">{line.speaker}</span>
                    <span className="ai-transcript-content">{line.content}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="ai-summary-view">
              <div className="ai-note-title-row">
                <div className="ai-note-title">REAL-TIME MEETING NOTES</div>
                <div className="ai-note-date">2025/04/22</div>
              </div>
              <div className="ai-summary-type-row">
                <label htmlFor="summaryType" className="ai-summary-type-label">회의록 타입 :</label>
                <select 
                  id="summaryType"
                  className="ai-summary-type-select"
                  value={summaryType}
                  onChange={e => setSummaryType(e.target.value)}
                >
                  <option value="bulleted">주요 논의 사항</option>
                  <option value="narrative">회의 요약</option>
                  <option value="actionItems">액션 아이템</option>
                </select>
              </div>
              <div className="ai-summary-content">
                <div className="ai-summary-title">{summaryContent[summaryType].title}</div>
                {Array.isArray(summaryContent[summaryType].content) ? (
                  <ul className="ai-summary-list">
                    {summaryContent[summaryType].content.map((item, idx) => (
                      <li key={idx}>{item}</li>
                    ))}
                  </ul>
                ) : (
                  <div className="ai-summary-narrative">{summaryContent[summaryType].content}</div>
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