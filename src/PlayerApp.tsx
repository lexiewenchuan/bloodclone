import React, { useEffect, useRef, useState } from 'react';
import { getTownMe, getTownWsUrl, joinTown, leaveTown, sitDown, type TownMeResponse } from './api/townClient';

interface PlayerSeatInfo {
  seatIndex: number;
  roleId: string;
  roleName: string;
  playerName: string;
  isDead: boolean;
  hasVote: boolean;
}

export default function PlayerApp() {
  const [townId, setTownId] = useState<string>(() => {
    try {
      return localStorage.getItem('playerTownId') || '';
    } catch {
      return '';
    }
  });
  const [userId, setUserId] = useState<string | null>(() => {
    try {
      return localStorage.getItem('playerUserId') || null;
    } catch {
      return null;
    }
  });
  const [seatCount, setSeatCount] = useState(0);
  const [mySeatIndex, setMySeatIndex] = useState<number | null>(null);
  const [scriptName, setScriptName] = useState<string>('');
  const [seatInfo, setSeatInfo] = useState<PlayerSeatInfo | null>(null);
  const [statusText, setStatusText] = useState<string>('请加入小镇');
  const [isJoining, setIsJoining] = useState(false);
  const [isSitting, setIsSitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshingSeat, setRefreshingSeat] = useState(false);
  // 记录座位占用状态：座位 index => 是否被占用
  const [seatOccupancy, setSeatOccupancy] = useState<Record<number, boolean>>({});
  const mySeatIndexRef = useRef<number | null>(null);
  mySeatIndexRef.current = mySeatIndex;
  // 记录最近一次通过 /town/me 拉取座位信息时使用的 townId/userId，避免旧请求覆盖新小镇的数据
  const lastFetchKeyRef = useRef<{ townId: string; userId: string } | null>(null);

  useEffect(() => {
    try {
      if (townId) localStorage.setItem('playerTownId', townId);
    } catch {
      // ignore
    }
  }, [townId]);

  useEffect(() => {
    try {
      if (userId) {
        localStorage.setItem('playerUserId', userId);
      } else {
        localStorage.removeItem('playerUserId');
      }
    } catch {
      // ignore
    }
  }, [userId]);

  // 进入/恢复某个小镇时，通过 /town/me 拉取一次当前状态（之后靠 WebSocket 推送更新）
  useEffect(() => {
    const trimmedTownId = townId?.trim();
    if (!trimmedTownId || !userId) return;
    const key = { townId: trimmedTownId, userId };
    // 若当前 townId/userId 与上次拉取一致，则不重复请求
    if (
      lastFetchKeyRef.current &&
      lastFetchKeyRef.current.townId === key.townId &&
      lastFetchKeyRef.current.userId === key.userId
    ) {
      return;
    }
    lastFetchKeyRef.current = key;
    getTownMe(key)
      .then((data: TownMeResponse) => {
        // 若在请求过程中用户已切换到其他小镇/身份，则丢弃本次结果，避免旧数据覆盖新小镇
        if (
          !lastFetchKeyRef.current ||
          lastFetchKeyRef.current.townId !== key.townId ||
          lastFetchKeyRef.current.userId !== key.userId
        ) {
          return;
        }
        if (data.townId === null) {
          setUserId(null);
          setSeatCount(0);
          setStatusText('小镇已失效，请重新加入');
          return;
        }
        setScriptName(data.scriptName || '');
        if (data.seatCount != null) setSeatCount(data.seatCount);
        if (data.mySeatIndex != null) setMySeatIndex(data.mySeatIndex);
        if (data.seat) {
          setSeatInfo(data.seat);
          setStatusText('说书人已为你发牌');
        } else {
          setSeatInfo(null);
          setStatusText(
            data.mySeatIndex != null
              ? `已坐在 ${data.mySeatIndex + 1} 号位，等待说书人发牌…`
              : (data.seatCount ?? 0) > 0
                ? '请点击下方座位号坐下'
                : '等待说书人设置座位',
          );
        }
      })
      .catch(() => setError('获取座位信息失败，请稍后重试。'));
  }, [townId, userId]);

  // 如果通过说书人发的链接进入（URL 中带有 townId 参数），且当前还未加入，则自动加入小镇
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const urlTownId = (params.get('townId') || '').trim();
    if (!urlTownId) return;
    // 已经是同一个小镇且有 userId，则不重复加入
    if (userId && townId === urlTownId) return;

    (async () => {
      try {
        setIsJoining(true);
        setError(null);
        setStatusText('正在加入小镇...');
        const result = await joinTown({ townId: urlTownId });
        setTownId(urlTownId);
        setUserId(result.userId);
        const count = typeof result.seatCount === 'number' ? result.seatCount : 0;
        setSeatCount(count);
        setMySeatIndex(null);
        setSeatInfo(null); // 清除上一局的座位信息（包括旧的角色数据）
        setStatusText(count > 0 ? '请点击下方座位号坐下' : '等待说书人设置座位');
      } catch (e) {
        console.error('[PlayerApp] 通过链接加入小镇失败', e);
        setError(e instanceof Error ? e.message : '加入小镇失败，请稍后重试。');
        setStatusText('加入小镇失败');
      } finally {
        setIsJoining(false);
      }
    })();
  // 只在首屏挂载时检查一次 URL
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // WebSocket：接收说书人推送的 settings、坐下确认 sit_ok、进入白天时的 game_data
  useEffect(() => {
    if (!townId?.trim() || !userId) return;
    const wsUrl = getTownWsUrl({ townId: townId.trim(), userId });
    const ws = new WebSocket(wsUrl);
    ws.onmessage = (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data as string);
        if (data.type === 'settings') {
          if (data.scriptName != null) setScriptName(String(data.scriptName));
          if (data.seatCount != null) setSeatCount(Number(data.seatCount));
          // 处理座位占用状态
          if (Array.isArray(data.occupancy)) {
            const occupancy: Record<number, boolean> = {};
            data.occupancy.forEach((seat: { seatIndex: number; occupied: boolean }) => {
              occupancy[seat.seatIndex] = seat.occupied;
            });
            setSeatOccupancy(occupancy);
          }
          setStatusText(
            data.seatCount > 0 ? '请点击下方座位号坐下' : '等待说书人设置座位',
          );
        } else if (data.type === 'sit_ok' && typeof data.seatIndex === 'number') {
          setMySeatIndex(data.seatIndex);
          setStatusText(`已坐在 ${data.seatIndex + 1} 号位，等待说书人发牌…`);
        } else if (data.type === 'seat_occupancy_update' && Array.isArray(data.occupancy)) {
          // 处理座位占用状态更新
          const occupancy: Record<number, boolean> = {};
          data.occupancy.forEach((seat: { seatIndex: number; occupied: boolean }) => {
            occupancy[seat.seatIndex] = seat.occupied;
          });
          setSeatOccupancy(occupancy);
        } else if (data.type === 'game_data' && Array.isArray(data.seats)) {
          const idx = mySeatIndexRef.current ?? -1;
          const mySeat = data.seats.find((s: { seatIndex: number }) => s.seatIndex === idx);
          if (mySeat) {
            setSeatInfo({
              seatIndex: mySeat.seatIndex,
              roleId: mySeat.roleId,
              roleName: mySeat.roleName,
              playerName: mySeat.playerName,
              isDead: mySeat.isDead,
              hasVote: mySeat.hasVote,
            });
            setStatusText('说书人已为你发牌');
          }
        }
      } catch {
        // ignore
      }
    };
    return () => ws.close();
  }, [townId, userId]);

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = townId.trim();
    if (!trimmed) {
      setError('请输入小镇号码');
      return;
    }
    try {
      setIsJoining(true);
      setError(null);
      setStatusText('正在加入小镇...');
      const result = await joinTown({ townId: trimmed });
      setTownId(trimmed);
      setUserId(result.userId);
      const count = typeof result.seatCount === 'number' ? result.seatCount : 0;
      setSeatCount(count);
      setMySeatIndex(null);
      setSeatOccupancy({});
      setStatusText(count > 0 ? '请点击下方座位号坐下' : '等待说书人设置座位');
    } catch (e) {
      console.error('[PlayerApp] 加入小镇失败', e);
      setError(e instanceof Error ? e.message : '加入小镇失败，请稍后重试。');
      setStatusText('加入小镇失败');
    } finally {
      setIsJoining(false);
    }
  };

  const handleSit = async (seatIndex: number) => {
    const tid = townId?.trim();
    if (!tid || !userId || isSitting) return;
    try {
      setIsSitting(true);
      setError(null);
      await sitDown({ townId: tid, userId, seatIndex });
      setMySeatIndex(seatIndex);
      setStatusText(`已坐在 ${seatIndex + 1} 号位，等待说书人发牌…`);
    } catch (e) {
      console.error('[PlayerApp] 坐下失败', e);
      setError(e instanceof Error ? e.message : '坐下失败，请稍后重试。');
    } finally {
      setIsSitting(false);
    }
  };

  const handleReset = async () => {
    if (townId && userId) {
      try {
        await leaveTown({ townId, userId });
      } catch (e) {
        console.error('[PlayerApp] 离开小镇失败（仅本地解绑）', e);
      }
    }
    lastFetchKeyRef.current = null;
    setUserId(null);
    setSeatCount(0);
    setMySeatIndex(null);
    setSeatInfo(null);
    setSeatOccupancy({});
    setStatusText('请加入小镇');
    setError(null);
  };

  const handleRefreshSeat = async () => {
    if (!townId?.trim() || !userId || refreshingSeat) return;
    try {
      setRefreshingSeat(true);
      setError(null);
      const data = await getTownMe({ townId: townId.trim(), userId });
      if (data.townId === null) {
        setUserId(null);
        setSeatCount(0);
        setStatusText('小镇已失效，请重新加入');
        return;
      }
      if (data.seatCount != null) setSeatCount(data.seatCount);
      if (data.mySeatIndex != null) setMySeatIndex(data.mySeatIndex);
      if (data.seat) setSeatInfo(data.seat);
      setStatusText(
        data.seatCount && data.seatCount > 0 ? '请点击下方座位号坐下' : '等待说书人设置座位',
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : '刷新失败');
    } finally {
      setRefreshingSeat(false);
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'radial-gradient(circle at top, #1e293b 0, #020617 60%)',
        color: '#e5e7eb',
        padding: 16,
        boxSizing: 'border-box',
        fontFamily:
          '-apple-system, BlinkMacSystemFont, "Segoe UI", "Microsoft YaHei", "PingFang SC", system-ui, sans-serif',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 420,
          background: 'rgba(15,23,42,0.9)',
          borderRadius: 16,
          padding: 20,
          boxShadow: '0 20px 40px rgba(0,0,0,0.6)',
          border: '1px solid rgba(148,163,184,0.4)',
          backdropFilter: 'blur(16px)',
        }}
      >
        <h1
          style={{
            margin: '0 0 12px 0',
            fontSize: 20,
            fontWeight: 700,
            color: '#fbbf24',
            textAlign: 'center',
            letterSpacing: 1,
          }}
        >
          血染钟楼 · 小镇玩家端
        </h1>

        <p style={{ margin: '0 0 16px 0', fontSize: 13, color: '#9ca3af', textAlign: 'center' }}>
          输入说书人提供的小镇号码加入，然后点击座位号坐下，等待说书人发牌。
        </p>

        {!userId && (
          <form onSubmit={handleJoin} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div>
              <label style={{ fontSize: 12, color: '#cbd5f5', display: 'block', marginBottom: 4 }}>
                小镇号码
              </label>
              <input
                type="text"
                value={townId}
                onChange={e => setTownId(e.target.value)}
                placeholder="例如：ABCD1234"
                style={{
                  width: '100%',
                  padding: '8px 10px',
                  borderRadius: 6,
                  border: '1px solid rgba(148,163,184,0.7)',
                  background: 'rgba(15,23,42,0.9)',
                  color: '#e5e7eb',
                  fontSize: 13,
                  outline: 'none',
                }}
              />
            </div>

            <button
              type="submit"
              disabled={isJoining}
              style={{
                marginTop: 4,
                padding: '8px 12px',
                borderRadius: 6,
                border: 'none',
                background: isJoining ? 'rgba(59,130,246,0.4)' : 'rgba(59,130,246,0.9)',
                color: '#e5e7eb',
                fontSize: 14,
                fontWeight: 600,
                cursor: isJoining ? 'default' : 'pointer',
              }}
            >
              {isJoining ? '正在加入…' : '加入小镇'}
            </button>
          </form>
        )}

        {userId && (
          <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div
              style={{
                padding: '8px 10px',
                borderRadius: 8,
                background: 'rgba(15,23,42,0.8)',
                border: '1px solid rgba(148,163,184,0.5)',
                fontSize: 13,
              }}
            >
              <div style={{ marginBottom: 4 }}>
                小镇：<span style={{ color: '#fbbf24', fontWeight: 600 }}>{townId}</span>
              </div>
            </div>

            <div
              style={{
                padding: '8px 10px',
                borderRadius: 8,
                background: 'rgba(24,24,27,0.9)',
                border: '1px solid rgba(55,65,81,0.9)',
                fontSize: 12,
                color: '#9ca3af',
              }}
            >
              {statusText}
              {scriptName && (
                <div style={{ marginTop: 4 }}>
                  当前剧本：<span style={{ color: '#e5e7eb' }}>{scriptName}</span>
                </div>
              )}
            </div>

            {!seatInfo && (
              <div>
                <div style={{ fontSize: 12, color: '#cbd5f5', marginBottom: 8 }}>
                  {seatCount > 0 ? '点击座位号坐下' : '等待说书人设置座位'}
                  {seatCount === 0 && userId && (
                    <button
                      type="button"
                      onClick={handleRefreshSeat}
                      disabled={refreshingSeat}
                      style={{
                        marginLeft: 8,
                        padding: '2px 8px',
                        fontSize: 11,
                        borderRadius: 4,
                        border: '1px solid rgba(148,163,184,0.6)',
                        background: 'rgba(15,23,42,0.9)',
                        color: '#94a3b8',
                        cursor: refreshingSeat ? 'default' : 'pointer',
                      }}
                    >
                      {refreshingSeat ? '刷新中…' : '刷新座位'}
                    </button>
                  )}
                </div>
                {seatCount > 0 && (
                  <div
                    style={{
                      display: 'flex',
                      flexWrap: 'wrap',
                      gap: 8,
                    }}
                  >
                    {Array.from({ length: seatCount }, (_, i) => {
                      const isOccupied = seatOccupancy[i] && mySeatIndex !== i;
                      const isMySheet = mySeatIndex === i;
                      return (
                        <div key={i} style={{ position: 'relative' }}>
                          <button
                            type="button"
                            onClick={() => handleSit(i)}
                            disabled={isSitting || isOccupied}
                            title={isOccupied ? '座位已被占用' : ''}
                            style={{
                              width: 44,
                              height: 44,
                              borderRadius: 8,
                              border:
                                isMySheet
                                  ? '2px solid rgba(34, 197, 94, 0.9)'
                                  : isOccupied
                                  ? '1px solid rgba(239, 68, 68, 0.6)'
                                  : '1px solid rgba(148,163,184,0.6)',
                              background:
                                isMySheet
                                  ? 'rgba(34, 197, 94, 0.2)'
                                  : isOccupied
                                  ? 'rgba(239, 68, 68, 0.15)'
                                  : 'rgba(15,23,42,0.9)',
                              color:
                                isMySheet
                                  ? '#86efac'
                                  : isOccupied
                                  ? '#ef4444'
                                  : '#e5e7eb',
                              fontSize: 14,
                              fontWeight: 600,
                              cursor: isSitting || isOccupied ? 'not-allowed' : 'pointer',
                              opacity: isOccupied ? 0.6 : 1,
                            }}
                          >
                            {i + 1}
                          </button>
                          {/* 占用状态指示器 */}
                          {isOccupied && (
                            <div
                              style={{
                                position: 'absolute',
                                top: -4,
                                right: -4,
                                width: 12,
                                height: 12,
                                borderRadius: '50%',
                                backgroundColor: '#ef4444',
                                boxShadow: '0 0 4px rgba(239, 68, 68, 0.8)',
                              }}
                            />
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {seatInfo && (
              <div
                style={{
                  marginTop: 4,
                  padding: '10px 12px',
                  borderRadius: 10,
                  background:
                    'radial-gradient(circle at top, rgba(248,250,252,0.06), rgba(15,23,42,0.98))',
                  border: '1px solid rgba(251,191,36,0.5)',
                  boxShadow: '0 10px 25px rgba(0,0,0,0.7)',
                }}
              >
                <div
                  style={{
                    fontSize: 13,
                    color: '#9ca3af',
                    marginBottom: 4,
                  }}
                >
                  你的座位：{seatInfo.seatIndex + 1} 号
                </div>
                <div
                  style={{
                    fontSize: 20,
                    fontWeight: 700,
                    color: '#facc15',
                    marginBottom: 8,
                  }}
                >
                  {seatInfo.roleName}
                </div>
                <div style={{ display: 'flex', gap: 8, fontSize: 12 }}>
                  <span
                    style={{
                      padding: '2px 8px',
                      borderRadius: 999,
                      border: '1px solid rgba(248,250,252,0.3)',
                      background: 'rgba(15,23,42,0.9)',
                    }}
                  >
                    {seatInfo.isDead ? '状态：死亡' : '状态：存活'}
                  </span>
                  <span
                    style={{
                      padding: '2px 8px',
                      borderRadius: 999,
                      border: '1px solid rgba(248,250,252,0.3)',
                      background: 'rgba(15,23,42,0.9)',
                    }}
                  >
                    {seatInfo.hasVote ? '拥有投票权' : '无投票权'}
                  </span>
                </div>
              </div>
            )}

            <button
              onClick={handleReset}
              style={{
                marginTop: 8,
                padding: '6px 10px',
                borderRadius: 6,
                border: '1px solid rgba(75,85,99,0.9)',
                background: 'transparent',
                color: '#9ca3af',
                fontSize: 12,
                cursor: 'pointer',
              }}
            >
              退出本设备绑定（不影响小镇）
            </button>
          </div>
        )}

        {error && (
          <div
            style={{
              marginTop: 10,
              padding: '6px 10px',
              borderRadius: 6,
              background: 'rgba(127,29,29,0.9)',
              color: '#fee2e2',
              fontSize: 12,
            }}
          >
            {error}
          </div>
        )}
      </div>
    </div>
  );
}
