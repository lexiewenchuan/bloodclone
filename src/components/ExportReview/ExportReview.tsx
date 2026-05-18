import React, { useState, useEffect, useRef, useMemo } from 'react';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { AppState, Seat, Status, RoleData } from '../../types';
import ReplaySnapshot from '../ReplaySnapshot/ReplaySnapshot';
import StatusToken from '../StatusToken/StatusToken';

interface ExportReviewProps {
  appState: AppState;
  phaseNotes: Record<string, string | any[]>;
  phaseCustomNotes: Record<string, string>;
  onClose: () => void;
}

// 提取每个阶段的玩家数据
interface PlayerPhaseData {
  seatId: number;
  playerName: string;
  roleName: string;
  roleImage?: string;
  statuses: { name: string; role?: RoleData; type?: string }[];
  events: string[];
}

const extractPlayerData = (
  phase: { type: string; count: number; seats: Seat[] },
  phaseNotes: Record<string, string | any[]>
): PlayerPhaseData[] => {
  const phaseKey = `${phase.type}_${phase.count}`;
  
  return phase.seats.map(seat => {
    // 获取事件卡片内容
    const noteKey = `${phaseKey}_${seat.id}`;
    const noteData = phaseNotes[noteKey];
    let events: string[] = [];
    
    if (Array.isArray(noteData)) {
      events = noteData
        .filter((event: any) => event.text && event.text.trim())
        .map((event: any) => event.text);
    } else if (typeof noteData === 'string' && noteData.trim()) {
      events = [noteData];
    }
    
    // 获取状态token - 保存完整数据以便渲染 StatusToken
    const statuses = seat.statuses.map(status => ({
      name: status.name,
      role: status.role,
      type: status.type
    }));
    
    return {
      seatId: seat.id + 1,
      playerName: seat.playerName || `玩家${seat.id + 1}`,
      roleName: seat.roleName || '未知角色',
      roleImage: seat.role?.image,
      statuses,
      events
    };
  });
};

export default function ExportReview({ appState, phaseNotes, onClose }: ExportReviewProps) {
  const [currentPhaseIndex, setCurrentPhaseIndex] = useState(-1);
  const [images, setImages] = useState<string[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const isCancelledRef = useRef(false);

  // 提取当前阶段的所有玩家数据
  const currentPhasePlayerData = useMemo(() => {
    if (currentPhaseIndex >= 0 && currentPhaseIndex < appState.history.length) {
      return extractPlayerData(appState.history[currentPhaseIndex], phaseNotes);
    }
    return [];
  }, [currentPhaseIndex, appState.history, phaseNotes]);

  // 提取所有阶段的玩家数据（用于最终PDF生成）
  const allPhasePlayerData = useMemo(() => {
    return appState.history.map(phase => ({
      phase,
      playerData: extractPlayerData(phase, phaseNotes)
    }));
  }, [appState.history, phaseNotes]);

  const handleCancel = () => {
    isCancelledRef.current = true;
    setIsProcessing(false);
    onClose();
  };

  // 等待截图容器内所有图片加载完成，避免 html2canvas 抓到空白头像
  const waitForImages = async (root: HTMLElement, timeout = 8000) => {
    const images = Array.from(root.querySelectorAll('img'));
    if (images.length === 0) return;

    let resolved = false;
    let loadedCount = 0;

    await new Promise<void>((resolve) => {
      const finish = () => {
        if (resolved) return;
        resolved = true;
        resolve();
      };

      const timer = window.setTimeout(finish, timeout);

      const checkDone = () => {
        loadedCount += 1;
        if (loadedCount >= images.length) {
          window.clearTimeout(timer);
          finish();
        }
      };

      images.forEach((img) => {
        if (img.complete) {
          checkDone();
        } else {
          const onLoad = () => {
            img.removeEventListener('load', onLoad);
            img.removeEventListener('error', onError);
            checkDone();
          };
          const onError = () => {
            img.removeEventListener('load', onLoad);
            img.removeEventListener('error', onError);
            checkDone();
          };
          img.addEventListener('load', onLoad);
          img.addEventListener('error', onError);
        }
      });
    });
  };

  useEffect(() => {
    if (currentPhaseIndex === -1 && !isProcessing) {
      setIsProcessing(true);
      setCurrentPhaseIndex(0);
    }
  }, []);

  useEffect(() => {
    const processPhase = async () => {
      if (isCancelledRef.current) {
        return;
      }

      if (currentPhaseIndex >= 0 && currentPhaseIndex < appState.history.length) {
        if (containerRef.current) {
          // 等待截图容器中的图片尽量加载完成（包含角色头像）
          await waitForImages(containerRef.current);

          try {
            const containerEl = containerRef.current;
            await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));

            const captureWidth = containerEl.clientWidth || 800;
            const captureHeight = containerEl.clientHeight || 720;

            const canvas = await html2canvas(containerEl, {
              scale: 3,
              useCORS: true,
              backgroundColor: '#ffffff',
              logging: false,
              width: captureWidth,
              height: captureHeight,
              windowWidth: captureWidth,
              windowHeight: captureHeight
            } as any);
            setImages(prev => [...prev, canvas.toDataURL('image/png')]);
            setProgress(Math.round(((currentPhaseIndex + 1) / appState.history.length) * 100));
            setCurrentPhaseIndex(prev => prev + 1);
          } catch (error) {
            console.error('Error capturing phase:', error);
            // Skip error and continue
            setCurrentPhaseIndex(prev => prev + 1);
          }
        }
      } else if (currentPhaseIndex === appState.history.length && isProcessing) {
        if (!isCancelledRef.current) {
          generatePDF();
        }
      }
    };

    processPhase();
  }, [currentPhaseIndex, isProcessing]);

  const generatePDF = async () => {
    if (isCancelledRef.current) return;

    try {
      const doc = new jsPDF('portrait', 'mm', 'a4');
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const availableWidth = pageWidth;
      const availableHeight = pageHeight;

      const loadImage = (src: string) =>
        new Promise<HTMLImageElement>((resolve, reject) => {
          const img = new Image();
          img.onload = () => resolve(img);
          img.onerror = reject;
          img.src = src;
        });

      for (let index = 0; index < images.length; index += 1) {
        if (isCancelledRef.current) {
          return;
        }

        const imgData = images[index];
        const img = await loadImage(imgData);
        
        if (index > 0) doc.addPage();

        doc.setFillColor(255, 255, 255);
        doc.rect(0, 0, pageWidth, pageHeight, 'F');
        const footerHeight = 10;
        const maxContentHeight = availableHeight - footerHeight;
        const contentWidth = availableWidth;
        const imgRatio = img.height / img.width;

        let renderWidth = contentWidth;
        let renderHeight = renderWidth * imgRatio;
        if (renderHeight > maxContentHeight) {
          renderHeight = maxContentHeight;
          renderWidth = renderHeight / imgRatio;
        }

        const x = (pageWidth - renderWidth) / 2;
        const y = (pageHeight - renderHeight) / 2;

        doc.addImage(
          imgData,
          'PNG',
          x,
          y,
          renderWidth,
          renderHeight,
          undefined,
          'FAST'
        );

        // 页脚
        doc.setFontSize(8);
        doc.setTextColor(150, 150, 150);
        const footerText = `Page ${index + 1} of ${images.length}`;
        doc.text(footerText, pageWidth / 2, pageHeight - 5, { align: 'center' });

        const promoLink = 'https://www.bloodclocktower.online/';
        doc.setTextColor(0, 0, 255);
        doc.setFontSize(10);
        const linkWidth = doc.getTextWidth(promoLink);
        doc.text(promoLink, pageWidth - 10 - linkWidth, pageHeight - 5);
        doc.link(pageWidth - 10 - linkWidth, pageHeight - 8, linkWidth, 5, { url: promoLink });
      }

      doc.save(`复盘_${appState.scriptInfo.name}_${new Date().toISOString().slice(0,10)}.pdf`);
    } catch (e) {
      console.error('PDF Generation failed', e);
      alert('PDF生成失败，请重试');
    } finally {
      setIsProcessing(false);
      if (!isCancelledRef.current) {
        onClose();
      }
    }
  };

  // Render logic
  if (!isProcessing && currentPhaseIndex === -1) return null;

  const currentPhase = appState.history[currentPhaseIndex];

  return (
    <div style={{ 
      position: 'fixed', 
      top: 0, 
      left: 0, 
      width: '100%', 
      height: '100%', 
      background: 'rgba(0,0,0,0.9)', 
      zIndex: 9999, 
      color: '#d4af37', 
      display: 'flex', 
      justifyContent: 'center', 
      alignItems: 'center', 
      flexDirection: 'column',
      fontFamily: '"Cinzel", "Noto Serif SC", serif'
    }}>
      <div style={{ fontSize: '24px', marginBottom: '20px' }}>
        正在生成复盘 PDF...
      </div>
      <div style={{ width: '300px', height: '4px', background: '#333', borderRadius: '2px', overflow: 'hidden' }}>
        <div style={{ width: `${progress}%`, height: '100%', background: '#d4af37', transition: 'width 0.3s' }} />
      </div>
      <div style={{ marginTop: '10px', fontSize: '14px', color: '#999' }}>
        {currentPhaseIndex + 1} / {appState.history.length}
      </div>

      <button
        type="button"
        onClick={handleCancel}
        style={{
          marginTop: '24px',
          padding: '8px 24px',
          borderRadius: '999px',
          border: '1px solid rgba(148, 163, 184, 0.8)',
          background: 'rgba(15, 23, 42, 0.9)',
          color: '#e5e7eb',
          cursor: 'pointer',
          fontSize: '14px',
          letterSpacing: '0.05em',
        }}
      >
        取消生成
      </button>

      {/* 截图容器：宽高比与 A4 一致；内层内容区固定宽并居中，使截图画面上左右留白相等，导出 PDF 后视觉居中 */}
      <div style={{ position: 'absolute', left: '-9999px', top: '-9999px', overflow: 'hidden' }}>
        {currentPhase && (
          <div 
            ref={containerRef}
            style={{
              width: '620px',
              minHeight: '877px',
              background: '#ffffff',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              padding: '12px 14px',
              boxSizing: 'border-box'
            }}
          >
            {/* 标题 */}
            <div style={{ 
              width: '100%', 
              height: currentPhaseIndex === 0 ? '70px' : '45px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#d4af37',
              fontSize: '20px',
              fontWeight: 'bold',
              gap: '3px',
              flexShrink: 0
            }}>
              {currentPhaseIndex === 0 && (
                <div style={{ fontSize: '20px', fontWeight: 'bold' }}>
                  {appState.scriptInfo.name}（{appState.history[0]?.seats.length || 0} 人）
                </div>
              )}
              <div style={{ fontSize: '16px', fontWeight: 'bold' }}>
                {currentPhase.type === 'night' ? `第 ${currentPhase.count} 夜` : `第 ${currentPhase.count} 天`}
              </div>
            </div>

            {/* 圆桌快照区域 - 缩小尺寸 */}
            <div style={{ 
              width: '320px', 
              height: '320px', 
              flexShrink: 0,
              marginTop: '5px',
              overflow: 'hidden',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <div style={{ width: '320px', height: '320px', transform: 'scale(0.533)', transformOrigin: 'center center' }}>
                <ReplaySnapshot phase={currentPhase} />
              </div>
            </div>

            {/* 玩家信息表格 - 紧跟圆桌 */}
            <div style={{ width: '100%', marginTop: '8px', flexShrink: 0 }}>
              <table style={{ 
                width: '100%', 
                borderCollapse: 'collapse', 
                fontSize: '9px',
                tableLayout: 'fixed'
              }}>
                <thead>
                  <tr style={{ background: '#f5f5f5' }}>
                    <th style={{ border: '1px solid #ccc', padding: '2px', width: '25px', textAlign: 'center' }}>序号</th>
                    <th style={{ border: '1px solid #ccc', padding: '2px', width: '80px', textAlign: 'center' }}>玩家/角色</th>
                    <th style={{ border: '1px solid #ccc', padding: '2px', width: '100px', textAlign: 'center' }}>状态</th>
                    <th style={{ border: '1px solid #ccc', padding: '2px', textAlign: 'center' }}>事件</th>
                  </tr>
                </thead>
                <tbody>
                  {currentPhasePlayerData.map((player) => (
                    <tr key={player.seatId}>
                      <td style={{ border: '1px solid #ccc', padding: '2px', textAlign: 'center' }}>{player.seatId}</td>
                      <td style={{ border: '1px solid #ccc', padding: '2px' }}>
                        <div style={{ fontWeight: 'bold', fontSize: '8px' }}>{player.playerName}</div>
                        <div style={{ color: '#666', fontSize: '7px' }}>{player.roleName}</div>
                      </td>
                      <td style={{ border: '1px solid #ccc', padding: '2px' }}>
                        {player.statuses.length > 0 ? (
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '2px', justifyContent: 'center' }}>
                            {player.statuses.map((status, idx) => (
                              <StatusToken
                                key={idx}
                                role={status.role}
                                statusName={status.name}
                                size={32}
                                disableHover
                                isCustom={status.type === 'custom'}
                              />
                            ))}
                          </div>
                        ) : <span style={{ color: '#999', fontSize: '8px' }}>-</span>}
                      </td>
                      <td style={{ border: '1px solid #ccc', padding: '2px' }}>
                        {player.events.length > 0 ? (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
                            {player.events.map((event, idx) => (
                              <div key={idx} style={{ fontSize: '7px', color: '#333' }}>{event}</div>
                            ))}
                          </div>
                        ) : <span style={{ color: '#999', fontSize: '8px' }}>-</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
