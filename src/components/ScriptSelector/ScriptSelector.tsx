import React, { useState, useEffect, useMemo } from 'react';
import { Script } from '../../types';
import { useApp } from '../../contexts/AppContext';
import { fetchSharedScriptsIndex, uploadSharedScript } from '../../api/scriptShareClient';

import Modal from '../Modal/Modal';

interface ScriptSelectorProps {
  onClose: () => void;
  onSelect: (script: Script) => void;
  onUpload: (file: File) => void;
  initialSearchTerm?: string;
  initialSelectedType?: string;
  onSearchTermChange?: (term: string) => void;
  onSelectedTypeChange?: (type: string) => void;
}

export default function ScriptSelector({ 
  onClose, 
  onSelect, 
  onUpload,
  initialSearchTerm = '',
  initialSelectedType = 'all',
  onSearchTermChange,
  onSelectedTypeChange
}: ScriptSelectorProps) {
  const { state, loadScripts, markLogoAsFailed, showToast } = useApp();
  const { scripts, isScriptsLoading, failedLogos } = state;
  
  const [searchTerm, setSearchTerm] = useState(initialSearchTerm);
  const [selectedType, setSelectedType] = useState(initialSelectedType);

  // 用户分享的剧本列表（仅通过上传接口产生）
  const [sharedScripts, setSharedScripts] = useState<Script[]>([]);
  const [isSharedLoading, setIsSharedLoading] = useState(false);

  // 上传弹窗状态
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [shareToWeb, setShareToWeb] = useState(true);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // 同步父组件传递的初始值
  useEffect(() => {
    setSearchTerm(initialSearchTerm);
  }, [initialSearchTerm]);

  useEffect(() => {
    setSelectedType(initialSelectedType);
  }, [initialSelectedType]);

  // 包装状态更新函数，同时通知父组件
  const handleSearchTermChange = (term: string) => {
    setSearchTerm(term);
    onSearchTermChange?.(term);
  };

  const handleSelectedTypeChange = (type: string) => {
    setSelectedType(type);
    onSelectedTypeChange?.(type);
  };

  // 统一的剧本列表（官方 + 用户分享）
  const allScripts = useMemo(() => {
    if (sharedScripts.length === 0) return scripts;
    const map = new Map<string, Script>();
    scripts.forEach((s) => map.set(s.id, s));
    sharedScripts.forEach((s) => map.set(s.id, s));
    return Array.from(map.values());
  }, [scripts, sharedScripts]);

  // 渲染单个剧本项
  const renderScriptItem = (script: Script) => {
    const hasLogo = script.logo && script.logo.trim() !== '' && !failedLogos[script.id];
    const hasAuthor = script.author && script.author !== '未选择' && script.author !== 'Unknown';

    // 基础卡片样式
    const cardStyle: React.CSSProperties = {
      padding: '16px',
      background: 'transparent',
      borderRadius: '16px',
      cursor: 'pointer',
      transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      border: '1px solid rgba(212, 175, 55, 0.1)',
      height: '260px', // 固定高度
      position: 'relative',
      overflow: 'hidden',
      boxSizing: 'border-box'
    };

    // 根据不同情况渲染内容
    const renderContent = () => {
      // 情况1: 有Logo、有作者、有名称
      if (hasLogo && hasAuthor) {
        return (
          <>
            <div style={{ 
              width: '100%', 
              height: '100px', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center',
              marginBottom: '12px'
            }}>
              <img 
                src={script.logo} 
                alt={script.name} 
                loading="lazy"
                onError={() => markLogoAsFailed(script.id)}
                style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', filter: 'drop-shadow(0 4px 6px rgba(0,0,0,0.3))' }}
              />
            </div>
            <div style={{ textAlign: 'center', width: '100%', flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
              <div style={{ 
                color: 'white', 
                fontWeight: 'bold', 
                fontSize: '16px', 
                marginBottom: '4px',
                lineHeight: '1.3',
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
                fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", "Microsoft YaHei", "微软雅黑", "PingFang SC", "Hiragino Sans GB", "Heiti SC", "SimHei", sans-serif'
              }}>
                {script.name}
              </div>
              <div style={{ color: 'rgba(255, 255, 255, 0.6)', fontSize: '12px', fontStyle: 'italic' }}>
                {script.author}
              </div>
            </div>
          </>
        );
      }

      // 情况2: 有Logo、有名称 (无作者)
      if (hasLogo && !hasAuthor) {
        return (
          <>
            <div style={{ 
              width: '100%', 
              height: '120px', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center',
              marginBottom: '16px'
            }}>
              <img 
                src={script.logo} 
                alt={script.name} 
                loading="lazy"
                onError={() => markLogoAsFailed(script.id)}
                style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', filter: 'drop-shadow(0 4px 6px rgba(0,0,0,0.3))' }}
              />
            </div>
            <div style={{ 
              textAlign: 'center', 
              width: '100%', 
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <div style={{ 
                color: 'white', 
                fontWeight: 'bold', 
                fontSize: '18px',
                lineHeight: '1.3',
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
                fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", "Microsoft YaHei", "微软雅黑", "PingFang SC", "Hiragino Sans GB", "Heiti SC", "SimHei", sans-serif'
              }}>
                {script.name}
              </div>
            </div>
          </>
        );
      }

      // 情况3: 有作者、有名称 (无Logo)
      if (!hasLogo && hasAuthor) {
        return (
          <div style={{ 
            flex: 1, 
            display: 'flex', 
            flexDirection: 'column', 
            justifyContent: 'center', 
            alignItems: 'center', 
            width: '100%',
            marginBottom: '10px'
          }}>
            <div style={{ 
              color: '#d4af37', 
              fontWeight: 'bold', 
              fontSize: '22px', 
              marginBottom: '8px', 
              textAlign: 'center',
              lineHeight: '1.3',
              display: '-webkit-box',
              WebkitLineClamp: 3,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
              fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", "Microsoft YaHei", "微软雅黑", "PingFang SC", "Hiragino Sans GB", "Heiti SC", "SimHei", sans-serif'
            }}>
              {script.name}
            </div>
            {script.author !== 'Unknown' && (
              <div style={{ color: 'rgba(255, 255, 255, 0.6)', fontSize: '14px', fontStyle: 'italic' }}>
                {script.author}
              </div>
            )}
          </div>
        );
      }

      // 情况4: 只有名称
      return (
        <div style={{ 
          flex: 1, 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center', 
          width: '100%',
          marginBottom: '10px'
        }}>
          <div style={{ 
            color: '#d4af37',
            fontWeight: 'bold', 
            fontSize: '24px', 
            textAlign: 'center',
            lineHeight: '1.4',
            display: '-webkit-box',
            WebkitLineClamp: 4,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", "Microsoft YaHei", "微软雅黑", "PingFang SC", "Hiragino Sans GB", "Heiti SC", "SimHei", sans-serif'
          }}>
            {script.name}
          </div>
        </div>
      );
    };

    return (
      <div 
        key={script.id}
        className="script-item"
        onClick={() => handleScriptSelect(script)}
        style={cardStyle}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = 'translateY(-4px)';
          e.currentTarget.style.boxShadow = '0 12px 24px rgba(0, 0, 0, 0.3)';
          e.currentTarget.style.borderColor = 'rgba(212, 175, 55, 0.6)';
          e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = 'translateY(0)';
          e.currentTarget.style.boxShadow = 'none';
          e.currentTarget.style.borderColor = 'rgba(212, 175, 55, 0.1)';
          e.currentTarget.style.background = 'transparent';
        }}
      >
        {renderContent()}

        {/* 底部标签区域 */}
        <div style={{
          marginTop: 'auto',
          display: 'flex',
          gap: '6px',
          flexWrap: 'wrap',
          justifyContent: 'center',
          width: '100%',
          paddingTop: '10px',
          borderTop: '1px solid rgba(255, 255, 255, 0.05)'
        }}>
          {Array.isArray(script.type) ? script.type.map((type, index) => (
            <div key={index} className="script-type-tag" style={{
              padding: '2px 8px',
              color: '#d4af37',
              fontSize: '10px',
              borderRadius: '12px',
              border: '1px solid rgba(212, 175, 55, 0.3)',
              fontWeight: '500',
              whiteSpace: 'nowrap'
            }}>
              {type}
            </div>
          )) : (
            <div className="script-type-tag" style={{
              padding: '2px 8px',
              color: '#d4af37',
              fontSize: '10px',
              borderRadius: '12px',
              border: '1px solid rgba(212, 175, 55, 0.3)',
              fontWeight: '500',
              whiteSpace: 'nowrap'
            }}>
              {script.type || ''}
            </div>
          )}
        </div>
      </div>
    );
  };

  // 加载剧本列表
  useEffect(() => {
    // 只有当剧本列表为空时才加载
    if (scripts.length === 0) {
      loadScripts();
    } else {
      console.log('剧本加载完成，总数量:', scripts.length);
      console.log('官方剧本列表:', scripts.filter(script => script.type.includes('官方')).map(script => script.name));
    }
  }, [scripts.length, loadScripts]);

  // 加载已分享的剧本列表
  useEffect(() => {
    const loadShared = async () => {
      setIsSharedLoading(true);
      try {
        const index = await fetchSharedScriptsIndex();
        const mapped: Script[] = index.map((item) => {
          const baseTypes =
            Array.isArray(item.types) ? item.types : item.types ? [item.types] : [];
          const types = baseTypes.length > 0 ? baseTypes : ['用户分享'];
          return {
            id: item.id,
            name: item.name,
            author: item.author || '',
            type: types,
            content: Array.isArray(item.data) ? item.data : null,
            logo: item.logo || '',
            isOfficial: false,
            sortOrder: item.createdAt,
          };
        });
        setSharedScripts(mapped);
      } catch (error) {
        console.error('加载分享剧本失败:', error);
      } finally {
        setIsSharedLoading(false);
      }
    };

    loadShared();
  }, []);

  // 按类型筛选和搜索剧本
  const filteredScripts = useMemo(() => {
    const lowerSearchTerm = searchTerm.toLowerCase();
    
    // 先过滤
    const filtered = allScripts.filter(script => {
      // 检查数据完整性
      if (!script || !script.id) return false;

      // 按类型筛选
      const typeMatch = selectedType === 'all' || (Array.isArray(script.type) ? script.type.includes(selectedType) : script.type === selectedType);
      
      // 按名称或作者搜索
      const searchMatch = script.name.toLowerCase().includes(lowerSearchTerm) || 
        (script.author && script.author.toLowerCase().includes(lowerSearchTerm));
      
      return typeMatch && searchMatch;
    });
    
    // 去重（使用 Map 根据 id 去重），防止因数据源问题导致重复显示
    const uniqueMap = new Map();
    filtered.forEach(script => {
      if (!uniqueMap.has(script.id)) {
        uniqueMap.set(script.id, script);
      }
    });
    
    // 转换为数组并排序
    const result = Array.from(uniqueMap.values());
    
    // 按特定规则排序
    result.sort((a, b) => {
      // 1. 指定的前5个剧本置顶
      const topScripts = [
        '暗流涌动',
        '黯月初升',
        '梦殒春宵',
        '窃窃私语·汀',
        '无上愉悦·汀'
      ];
      
      const indexA = topScripts.indexOf(a.name);
      const indexB = topScripts.indexOf(b.name);
      
      if (indexA !== -1 && indexB !== -1) return indexA - indexB;
      if (indexA !== -1) return -1;
      if (indexB !== -1) return 1;
      
      // 2. 无type的排在最后 (type为空数组)
      const aHasType = Array.isArray(a.type) && a.type.length > 0;
      const bHasType = Array.isArray(b.type) && b.type.length > 0;
      
      if (aHasType && !bHasType) return -1;
      if (!aHasType && bHasType) return 1;
      
      // 3. 有logo的排在前面
      // 检查logo是否存在且不是失败的logo
      const aHasLogo = a.logo && a.logo.trim() !== '' && !failedLogos[a.id];
      const bHasLogo = b.logo && b.logo.trim() !== '' && !failedLogos[b.id];
      
      if (aHasLogo && !bHasLogo) return -1;
      if (!aHasLogo && bHasLogo) return 1;
      
      // 4. 其他按名称排序
      return a.name.localeCompare(b.name, 'zh-CN');
    });
    
    return result;
  }, [allScripts, selectedType, searchTerm, failedLogos]);

  // 提取所有唯一的剧本类型（避免使用 flatMap，以兼容部分旧版移动浏览器）
  const scriptTypes = useMemo(() => {
    const allTypes: string[] = [];
    allScripts.forEach(script => {
      if (!script) return;
      const t = script.type;
      // Script.type 在类型上是 string[]，这里仍做防御性判断以兼容潜在的旧数据
      if (Array.isArray(t)) {
        t.forEach(item => {
          if (typeof item === 'string') {
            const v = item.trim();
            if (v) {
              allTypes.push(v);
            }
          }
        });
      }
    });
    const uniqueTypes = Array.from(new Set(allTypes));
    // 按首字母排序
    uniqueTypes.sort((a, b) => a.localeCompare(b, 'zh-CN'));
    return ['all', ...uniqueTypes];
  }, [allScripts]);

  // 处理剧本选择
  const handleScriptSelect = async (script: Script) => {
    try {
      onSelect(script);
    } catch (error) {
      console.error('选择剧本失败:', error);
      alert(`加载剧本失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  };

  // 处理上传弹窗内选择文件
  const handleUploadFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    setSelectedFile(file);
    setUploadError(null);
  };

  const handleUploadConfirm = () => {
    if (!selectedFile) {
      setUploadError('请先选择 JSON 文件');
      return;
    }

    // 第一步：始终先走本地上传逻辑，让用户直接使用剧本
    try {
      onUpload(selectedFile);
    } catch (error) {
      console.error('本地上传剧本失败:', error);
      setUploadError(error instanceof Error ? error.message : '本地上传失败');
      return;
    }

    // 如果未勾选「同步分享到本网页」，到这里就结束
    if (!shareToWeb) {
      setShowUploadModal(false);
      setSelectedFile(null);
      setShareToWeb(true);
      setUploadError(null);
      return;
    }

    // 第二步：后台异步同步分享逻辑
    setIsUploading(true);
    setUploadError(null);

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const text = String(event.target?.result ?? '');
        const result = await uploadSharedScript(text);
        if (!result.ok) {
          throw new Error(result.error || (result.errors && result.errors[0]) || '上传失败');
        }

        // 重新加载分享剧本索引
        const index = await fetchSharedScriptsIndex();
        const mapped: Script[] = index.map((item) => {
          const baseTypes =
            Array.isArray(item.types) ? item.types : item.types ? [item.types] : [];
          const types = baseTypes.length > 0 ? baseTypes : ['用户分享'];
          return {
            id: item.id,
            name: item.name,
            author: item.author || '',
            type: types,
            content: Array.isArray(item.data) ? item.data : null,
            logo: item.logo || '',
            isOfficial: false,
            sortOrder: item.createdAt,
          };
        });
        setSharedScripts(mapped);

        showToast?.('上传成功，所有用户将在剧本列表看到你分享的剧本', 'success');

        setShowUploadModal(false);
        setSelectedFile(null);
        setShareToWeb(true);
        setUploadError(null);
      } catch (error) {
        console.error('上传并分享剧本失败:', error);
        const msg = error instanceof Error ? error.message : '上传失败';
        setUploadError(msg);
        showToast?.(`上传失败，${msg}`, 'error');
      } finally {
        setIsUploading(false);
      }
    };
    reader.onerror = () => {
      setIsUploading(false);
      setUploadError('读取文件失败');
      showToast?.('上传失败，读取文件失败', 'error');
    };
    reader.readAsText(selectedFile);
  };

  return (
    <Modal
      title="选择剧本"
      onClose={onClose}
      width="1200px"
      headerExtra={null}
    >
      {/* 顶部操作栏：筛选、搜索和上传 */}
      <div style={{ marginBottom: '20px', display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
          {/* 类型筛选 */}
          <div style={{ display: 'flex', gap: '5px', alignItems: 'center' }}>
            <span style={{ color: 'white', fontSize: '14px' }}>类型:</span>
            <select 
              value={selectedType} 
              onChange={(e) => handleSelectedTypeChange(e.target.value)}
              style={{
                padding: '8px 12px',
                borderRadius: '4px',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                background: 'transparent',
                color: 'white',
                outline: 'none',
                cursor: 'pointer'
              }}
            >
              {scriptTypes.map((type) => (
                <option key={type} value={type}>
                  {type === 'all' ? '全部' : type}
                </option>
              ))}
            </select>
          </div>
          
          {/* 搜索框 */}
          <div style={{ flex: 1, minWidth: '200px' }}>
            <input
              type="text"
              placeholder="搜索剧本..."
              value={searchTerm}
              onChange={(e) => handleSearchTermChange(e.target.value)}
              style={{
                width: '100%',
                padding: '8px 12px',
                borderRadius: '4px',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                background: 'transparent',
                color: 'white',
                outline: 'none'
              }}
            />
          </div>
          
          {/* 剧本数量显示 */}
          <div style={{ color: 'rgba(255, 255, 255, 0.6)', fontSize: '14px', whiteSpace: 'nowrap' }}>
            共 {filteredScripts.length} 个剧本
          </div>
        </div>
        
        {/* 上传剧本按钮 */}
        <div>
          <button
            type="button"
            onClick={() => setShowUploadModal(true)}
            style={{
            padding: '6px 12px',
            color: '#d4af37',
            border: '1px solid rgba(212, 175, 55, 0.5)',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '14px',
            background: 'transparent',
            transition: 'all 0.2s ease'
          }}
          >
            上传JSON
          </button>
        </div>
      </div>

      {/* 剧本列表：恢复原来的网格排版，但保留骨架屏加载体验 */}
      <div>
        {isScriptsLoading ? (
          <div style={{ padding: '10px' }}>
            <div style={{ color: '#d4af37', textAlign: 'center', padding: '10px' }}>
              <i className="fa fa-spinner fa-spin"></i> 加载剧本索引中...
            </div>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
              gap: '20px',
              padding: '10px'
            }}>
              {Array.from({ length: 12 }).map((_, index) => (
                <div
                  key={index}
                  style={{
                    padding: '16px',
                    borderRadius: '16px',
                    border: '1px solid rgba(212, 175, 55, 0.1)',
                    height: '260px',
                    background: 'rgba(15, 23, 42, 0.8)',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    boxSizing: 'border-box'
                  }}
                >
                  <div style={{
                    width: '100%',
                    height: '100px',
                    borderRadius: '8px',
                    background: 'linear-gradient(90deg, rgba(30, 64, 175, 0.3), rgba(15, 23, 42, 0.6))'
                  }} />
                  <div style={{ marginTop: '12px' }}>
                    <div style={{
                      width: '80%',
                      height: '14px',
                      borderRadius: '999px',
                      background: 'rgba(148, 163, 184, 0.4)',
                      marginBottom: '8px'
                    }} />
                    <div style={{
                      width: '60%',
                      height: '12px',
                      borderRadius: '999px',
                      background: 'rgba(71, 85, 105, 0.5)'
                    }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
            gap: '20px',
            padding: '10px'
          }}>
            {filteredScripts.map(script => renderScriptItem(script))}
            {filteredScripts.length === 0 && (
              <div style={{ color: '#9ca3af', textAlign: 'center', padding: '40px', width: '100%', gridColumn: '1 / -1' }}>
                暂无可用剧本
              </div>
            )}
          </div>
        )}
      </div>

      {/* 上传剧本弹窗 */}
      {showUploadModal && (
        <Modal
          title="上传剧本"
          onClose={() => {
            if (isUploading) return;
            setShowUploadModal(false);
            setSelectedFile(null);
            setUploadError(null);
            setShareToWeb(true);
          }}
          width="360px"
          height="auto"
          headerExtra={null}
        >
          <div style={{ padding: '12px', color: '#e5e7eb', fontSize: '13px' }}>
            <div style={{ marginBottom: '12px' }}>
              <button
                type="button"
                onClick={() => {
                  const input = document.getElementById('upload-script-file-input') as HTMLInputElement | null;
                  if (input) {
                    input.click();
                  }
                }}
                style={{
                  padding: '6px 12px',
                  borderRadius: '4px',
                  border: '1px solid rgba(212, 175, 55, 0.6)',
                  background: 'transparent',
                  color: '#d4af37',
                  cursor: 'pointer',
                  fontSize: '13px',
                }}
                disabled={isUploading}
              >
                选择JSON文件
              </button>
              <input
                id="upload-script-file-input"
                type="file"
                accept=".json"
                onChange={handleUploadFileChange}
                style={{ display: 'none' }}
              />
              <div style={{ marginTop: '8px', fontSize: '12px', color: '#9ca3af' }}>
                {selectedFile ? `已选择文件：${selectedFile.name}` : '尚未选择文件'}
              </div>
            </div>

            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
              <input
                type="checkbox"
                checked={shareToWeb}
                onChange={(e) => setShareToWeb(e.target.checked)}
                disabled={isUploading}
              />
              <span>同步分享到本网页</span>
            </label>
            <div style={{ fontSize: '12px', color: '#9ca3af', marginBottom: '12px' }}>
              勾选后，系统会校验剧本有效性，通过后将该剧本分享至本网页，其他玩家也可在「用户分享」中看到并使用。
            </div>

            {uploadError && (
              <div style={{ color: '#f87171', fontSize: '12px', marginBottom: '8px' }}>
                {uploadError}
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '12px' }}>
              <button
                type="button"
                onClick={() => {
                  if (isUploading) return;
                  setShowUploadModal(false);
                  setSelectedFile(null);
                  setUploadError(null);
                  setShareToWeb(true);
                }}
                style={{
                  padding: '6px 12px',
                  borderRadius: '4px',
                  border: '1px solid rgba(148, 163, 184, 0.6)',
                  background: 'transparent',
                  color: '#e5e7eb',
                  cursor: 'pointer',
                  fontSize: '14px',
                }}
              >
                取消
              </button>
              <button
                type="button"
                onClick={handleUploadConfirm}
                disabled={isUploading}
                style={{
                  padding: '6px 12px',
                  borderRadius: '4px',
                  border: '1px solid rgba(212, 175, 55, 0.8)',
                  background: isUploading ? 'rgba(212, 175, 55, 0.1)' : 'rgba(212, 175, 55, 0.2)',
                  color: '#facc15',
                  cursor: isUploading ? 'not-allowed' : 'pointer',
                  fontSize: '14px',
                }}
              >
                {isUploading ? '上传中...' : '开始上传'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </Modal>
  );
}
