import React from 'react';
import { useApp } from '../../contexts/AppContext';
import './GameTimeline.css';

const GameTimeline: React.FC = () => {
  const { state, dispatch } = useApp();
  const { history, currentPhaseIndex } = state;
  const currentPhase = history[currentPhaseIndex];

  const handlePrev = () => {
    dispatch({ type: 'PREV_PHASE' });
  };

  const handleNext = () => {
    dispatch({ type: 'NEXT_PHASE' });
  };

  const handleForward = () => {
    dispatch({ type: 'MOVE_FORWARD' });
  };

  const isLastPhase = currentPhaseIndex === history.length - 1;

  return (
    <div className="game-timeline">
      <div className="timeline-controls">
        <button 
          className="timeline-btn" 
          onClick={handlePrev} 
          disabled={currentPhaseIndex === 0}
          title="上一阶段"
        >
          <i className="fa fa-chevron-left"></i>
        </button>

        <div className="timeline-display">
          <div className="phase-indicator">
            <span className={`phase-icon ${currentPhase.type}`}>
              {currentPhase.type === 'night' ? '🌙' : '☀️'}
            </span>
            <span className="phase-text">
              {currentPhase.type === 'night' && currentPhase.count === 1 ? (
                '首夜'
              ) : (
                <>
                  第 <span className="phase-number">{currentPhase.count}</span> {currentPhase.type === 'night' ? '夜' : '天'}
                </>
              )}
            </span>
          </div>
        </div>

        {isLastPhase ? (
          <button 
            className="timeline-btn highlight" 
            onClick={handleNext}
            title="进入下一阶段"
          >
            <i className="fa fa-chevron-right"></i>
            <span className="next-text">
              {currentPhase.type === 'night' ? '天亮' : '入夜'}
            </span>
          </button>
        ) : (
          <button 
            className="timeline-btn" 
            onClick={handleForward}
            title="回到当前进度"
          >
            <i className="fa fa-arrow-right"></i>
          </button>
        )}
      </div>
    </div>
  );
};

export default GameTimeline;
