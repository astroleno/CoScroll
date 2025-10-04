'use client';

import { useState } from 'react';
import JadeV6 from '@/components/jade/JadeV6';

const MODELS = [
  '/models/10k_obj/001_空.obj',
  '/models/10k_obj/002_心.obj',
  '/models/10k_obj/003_道.obj',
];

export default function Page() {
  const [idx, setIdx] = useState(0);
  // 内层材质参数
  const [innerColor, setInnerColor] = useState('#2d6d8b');
  const [innerMetalness, setInnerMetalness] = useState(1.0);
  const [innerRoughness, setInnerRoughness] = useState(1.0);
  const [innerTransmission, setInnerTransmission] = useState(0.0);
  const [innerEmissiveColor, setInnerEmissiveColor] = useState('#0f2b38');
  const [innerEmissiveIntensity, setInnerEmissiveIntensity] = useState(12.0);
  const [enableEmissive, setEnableEmissive] = useState(true);
  const [innerEnvMapIntensity, setInnerEnvMapIntensity] = useState(2.0);
  // 外层材质参数
  const [outerColor, setOuterColor] = useState('#ffffff');
  const [outerMetalness, setOuterMetalness] = useState(0.0);
  const [outerRoughness, setOuterRoughness] = useState(0.85);
  const [outerTransmission, setOuterTransmission] = useState(1.0);
  const [outerIor, setOuterIor] = useState(1.5);
  const [outerReflectivity, setOuterReflectivity] = useState(0.30);
  const [outerThickness, setOuterThickness] = useState(0.24);
  const [outerClearcoat, setOuterClearcoat] = useState(0.0);
  const [outerClearcoatRoughness, setOuterClearcoatRoughness] = useState(1.0);
  const [outerEnvMapIntensity, setOuterEnvMapIntensity] = useState(5.0);
  
  // 几何体优化（外壳细分）
  const [maxEdge, setMaxEdge] = useState(0.15);
  const [subdivisions, setSubdivisions] = useState(0);
  const [creaseAngle, setCreaseAngle] = useState(30);
  
  // 平滑着色控制
  const [smoothShading, setSmoothShading] = useState(true);
  const [innerSmoothShading, setInnerSmoothShading] = useState(true);
  const [outerSmoothShading, setOuterSmoothShading] = useState(true);
  
  const [showHdrBackground, setShowHdrBackground] = useState(false);
  const [showInnerLayer, setShowInnerLayer] = useState(true);
  const [showOuterLayer, setShowOuterLayer] = useState(true);
  const [outerOffset, setOuterOffset] = useState(0.001);
  
  // 滚动控制参数（新增）
  const [enableScrollControl, setEnableScrollControl] = useState(true);
  const [baseSpeed, setBaseSpeed] = useState(0.4);
  const [speedMultiplier, setSpeedMultiplier] = useState(3.0);
  const [externalVelocity, setExternalVelocity] = useState(0);

  return (
    <div style={{ position: 'fixed', inset: 0, background: '#1f1e1c' }}>
      {/* 顶部简单切换按钮 */}
      <div style={{ position: 'absolute', top: 12, left: 12, zIndex: 10, display: 'flex', gap: 8 }}>
        {MODELS.map((m, i) => (
          <button 
            key={m} 
            onClick={() => setIdx(i)} 
            style={{ 
              padding: '6px 10px', 
              borderRadius: 6,
              background: i === idx ? '#4a5568' : '#2d3748',
              color: 'white',
              border: '1px solid #4a5568',
              cursor: 'pointer'
            }}
          >
            {i + 1}
          </button>
        ))}
      </div>

      {/* 完整材质控制面板 */}
      <div style={{ 
        position: 'absolute', 
        top: 12, 
        right: 12, 
        zIndex: 10, 
        background: 'rgba(0,0,0,0.9)', 
        color: 'white', 
        padding: '16px', 
        borderRadius: 8,
        fontSize: '12px',
        minWidth: '320px',
        maxHeight: '85vh',
        overflowY: 'auto',
        border: '1px solid #333'
      }}>
        <div style={{ fontWeight: 'bold', marginBottom: '16px', fontSize: '14px', color: '#4CAF50' }}>JadeV6 双层材质控制</div>
        
        {/* 内层材质控制 */}
        <div style={{ marginBottom: '16px', padding: '8px', background: 'rgba(76, 175, 80, 0.1)', borderRadius: '4px' }}>
          <div style={{ fontWeight: 'bold', marginBottom: '8px', color: '#4CAF50' }}>内层材质 (自发光层)</div>
          
          <div style={{ marginBottom: '8px' }}>
            <div style={{ marginBottom: '4px' }}>内层颜色:</div>
            <input 
              type="color" 
              value={innerColor}
              onChange={(e) => setInnerColor(e.target.value)}
              style={{ width: '100%', height: '24px', border: 'none', borderRadius: '4px' }}
            />
          </div>
          
          <div style={{ marginBottom: '8px' }}>
            <div style={{ marginBottom: '4px' }}>金属度: {innerMetalness.toFixed(2)}</div>
            <input 
              type="range" 
              min="0" 
              max="1" 
              step="0.01" 
              value={innerMetalness}
              onChange={(e) => setInnerMetalness(parseFloat(e.target.value))}
              style={{ width: '100%' }}
            />
          </div>
          
          <div style={{ marginBottom: '8px' }}>
            <div style={{ marginBottom: '4px' }}>粗糙度: {innerRoughness.toFixed(2)}</div>
            <input 
              type="range" 
              min="0" 
              max="1" 
              step="0.01" 
              value={innerRoughness}
              onChange={(e) => setInnerRoughness(parseFloat(e.target.value))}
              style={{ width: '100%' }}
            />
          </div>
          
          <div style={{ marginBottom: '8px' }}>
            <div style={{ marginBottom: '4px' }}>透射度: {innerTransmission.toFixed(2)}</div>
            <input 
              type="range" 
              min="0" 
              max="1" 
              step="0.01" 
              value={innerTransmission}
              onChange={(e) => setInnerTransmission(parseFloat(e.target.value))}
              style={{ width: '100%' }}
            />
          </div>
          
          <div style={{ marginBottom: '8px' }}>
            <div style={{ marginBottom: '4px' }}>自发光颜色:</div>
            <input 
              type="color" 
              value={innerEmissiveColor}
              onChange={(e) => setInnerEmissiveColor(e.target.value)}
              style={{ width: '100%', height: '24px', border: 'none', borderRadius: '4px' }}
            />
          </div>
          
          <div style={{ marginBottom: '8px' }}>
            <div style={{ marginBottom: '4px' }}>自发光强度: {innerEmissiveIntensity.toFixed(2)}</div>
            <input 
              type="range" 
              min="0" 
              max="20" 
              step="0.1" 
              value={innerEmissiveIntensity}
              onChange={(e) => setInnerEmissiveIntensity(parseFloat(e.target.value))}
              style={{ width: '100%' }}
            />
          </div>
          
          <div style={{ marginBottom: '8px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <input 
                type="checkbox" 
                checked={enableEmissive}
                onChange={(e) => setEnableEmissive(e.target.checked)}
              />
              <span>启用自发光</span>
            </label>
          </div>
          
          <div style={{ marginBottom: '8px' }}>
            <div style={{ marginBottom: '4px' }}>环境反射强度: {innerEnvMapIntensity.toFixed(2)}</div>
            <input 
              type="range" 
              min="0" 
              max="5" 
              step="0.01" 
              value={innerEnvMapIntensity}
              onChange={(e) => setInnerEnvMapIntensity(parseFloat(e.target.value))}
              style={{ width: '100%' }}
            />
          </div>
        </div>
        
        {/* 外层材质控制 */}
        <div style={{ marginBottom: '16px', padding: '8px', background: 'rgba(33, 150, 243, 0.1)', borderRadius: '4px' }}>
          <div style={{ fontWeight: 'bold', marginBottom: '8px', color: '#2196F3' }}>外层材质 (折射层)</div>
          
          <div style={{ marginBottom: '8px' }}>
            <div style={{ marginBottom: '4px' }}>外层颜色:</div>
            <input 
              type="color" 
              value={outerColor}
              onChange={(e) => setOuterColor(e.target.value)}
              style={{ width: '100%', height: '24px', border: 'none', borderRadius: '4px' }}
            />
          </div>
          
          <div style={{ marginBottom: '8px' }}>
            <div style={{ marginBottom: '4px' }}>金属度: {outerMetalness.toFixed(2)}</div>
            <input 
              type="range" 
              min="0" 
              max="1" 
              step="0.01" 
              value={outerMetalness}
              onChange={(e) => setOuterMetalness(parseFloat(e.target.value))}
              style={{ width: '100%' }}
            />
          </div>
          
          <div style={{ marginBottom: '8px' }}>
            <div style={{ marginBottom: '4px' }}>粗糙度: {outerRoughness.toFixed(2)}</div>
            <input 
              type="range" 
              min="0" 
              max="1" 
              step="0.01" 
              value={outerRoughness}
              onChange={(e) => setOuterRoughness(parseFloat(e.target.value))}
              style={{ width: '100%' }}
            />
          </div>
          
          <div style={{ marginBottom: '8px' }}>
            <div style={{ marginBottom: '4px' }}>透射度: {outerTransmission.toFixed(2)}</div>
            <input 
              type="range" 
              min="0" 
              max="1" 
              step="0.01" 
              value={outerTransmission}
              onChange={(e) => setOuterTransmission(parseFloat(e.target.value))}
              style={{ width: '100%' }}
            />
          </div>
          
          <div style={{ marginBottom: '8px' }}>
            <div style={{ marginBottom: '4px' }}>折射率: {outerIor.toFixed(2)}</div>
            <input 
              type="range" 
              min="1" 
              max="2.5" 
              step="0.01" 
              value={outerIor}
              onChange={(e) => setOuterIor(parseFloat(e.target.value))}
              style={{ width: '100%' }}
            />
          </div>
          
          <div style={{ marginBottom: '8px' }}>
            <div style={{ marginBottom: '4px' }}>反射率: {outerReflectivity.toFixed(2)}</div>
            <input 
              type="range" 
              min="0" 
              max="1" 
              step="0.01" 
              value={outerReflectivity}
              onChange={(e) => setOuterReflectivity(parseFloat(e.target.value))}
              style={{ width: '100%' }}
            />
          </div>
          
          <div style={{ marginBottom: '8px' }}>
            <div style={{ marginBottom: '4px' }}>厚度: {outerThickness.toFixed(2)}</div>
            <input 
              type="range" 
              min="0" 
              max="2" 
              step="0.01" 
              value={outerThickness}
              onChange={(e) => setOuterThickness(parseFloat(e.target.value))}
              style={{ width: '100%' }}
            />
          </div>
          
          <div style={{ marginBottom: '8px' }}>
            <div style={{ marginBottom: '4px' }}>清漆层: {outerClearcoat.toFixed(2)}</div>
            <input 
              type="range" 
              min="0" 
              max="1" 
              step="0.01" 
              value={outerClearcoat}
              onChange={(e) => setOuterClearcoat(parseFloat(e.target.value))}
              style={{ width: '100%' }}
            />
          </div>
          
          <div style={{ marginBottom: '8px' }}>
            <div style={{ marginBottom: '4px' }}>清漆粗糙度: {outerClearcoatRoughness.toFixed(2)}</div>
            <input 
              type="range" 
              min="0" 
              max="1" 
              step="0.01" 
              value={outerClearcoatRoughness}
              onChange={(e) => setOuterClearcoatRoughness(parseFloat(e.target.value))}
              style={{ width: '100%' }}
            />
          </div>
          
          <div style={{ marginBottom: '8px' }}>
            <div style={{ marginBottom: '4px' }}>环境反射强度: {outerEnvMapIntensity.toFixed(2)}</div>
            <input 
              type="range" 
              min="0" 
              max="5" 
              step="0.01" 
              value={outerEnvMapIntensity}
              onChange={(e) => setOuterEnvMapIntensity(parseFloat(e.target.value))}
              style={{ width: '100%' }}
            />
          </div>
        </div>
        
        {/* 几何体优化控制 */}
        <div style={{ marginBottom: '16px', padding: '8px', background: 'rgba(156, 39, 176, 0.1)', borderRadius: '4px' }}>
          <div style={{ fontWeight: 'bold', marginBottom: '8px', color: '#9C27B0' }}>外壳细分控制</div>
          
          <div style={{ marginBottom: '8px' }}>
            <div style={{ marginBottom: '4px' }}>最大边长: {maxEdge.toFixed(3)}</div>
            <input 
              type="range" 
              min="0.01" 
              max="0.15" 
              step="0.001" 
              value={maxEdge}
              onChange={(e) => setMaxEdge(parseFloat(e.target.value))}
              style={{ width: '100%' }}
            />
          </div>
          
          <div style={{ marginBottom: '8px' }}>
            <div style={{ marginBottom: '4px' }}>细分次数: {subdivisions}</div>
            <input 
              type="range" 
              min="0" 
              max="1" 
              step="1" 
              value={subdivisions}
              onChange={(e) => setSubdivisions(parseInt(e.target.value))}
              style={{ width: '100%' }}
            />
          </div>
          
          <div style={{ marginBottom: '8px' }}>
            <div style={{ marginBottom: '4px' }}>折痕角度: {creaseAngle}°</div>
            <input 
              type="range" 
              min="30" 
              max="90" 
              step="1" 
              value={creaseAngle}
              onChange={(e) => setCreaseAngle(parseInt(e.target.value))}
              style={{ width: '100%' }}
            />
          </div>
        </div>
        
        {/* 平滑着色控制 */}
        <div style={{ marginBottom: '16px', padding: '8px', background: 'rgba(76, 175, 80, 0.1)', borderRadius: '4px' }}>
          <div style={{ fontWeight: 'bold', marginBottom: '8px', color: '#4CAF50' }}>平滑着色控制</div>
          
          <div style={{ marginBottom: '8px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <input 
                type="checkbox" 
                checked={smoothShading}
                onChange={(e) => setSmoothShading(e.target.checked)}
              />
              <span>全局平滑着色</span>
            </label>
          </div>
          
          <div style={{ marginBottom: '8px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <input 
                type="checkbox" 
                checked={innerSmoothShading}
                onChange={(e) => setInnerSmoothShading(e.target.checked)}
              />
              <span>内层平滑着色</span>
            </label>
          </div>
          
          <div style={{ marginBottom: '8px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <input 
                type="checkbox" 
                checked={outerSmoothShading}
                onChange={(e) => setOuterSmoothShading(e.target.checked)}
              />
              <span>外层平滑着色</span>
            </label>
          </div>
        </div>
        
        {/* 图层控制 */}
        <div style={{ marginBottom: '16px', padding: '8px', background: 'rgba(255, 152, 0, 0.1)', borderRadius: '4px' }}>
          <div style={{ fontWeight: 'bold', marginBottom: '8px', color: '#FF9800' }}>图层控制</div>
          
          <div style={{ marginBottom: '8px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <input 
                type="checkbox" 
                checked={showInnerLayer}
                onChange={(e) => setShowInnerLayer(e.target.checked)}
              />
              <span>显示内层</span>
            </label>
          </div>
          
          <div style={{ marginBottom: '8px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <input 
                type="checkbox" 
                checked={showOuterLayer}
                onChange={(e) => setShowOuterLayer(e.target.checked)}
              />
              <span>显示外层</span>
            </label>
          </div>
          
          <div style={{ marginBottom: '8px' }}>
            <div style={{ marginBottom: '4px' }}>外部层偏移: {outerOffset.toFixed(3)}</div>
            <input 
              type="range" 
              min="0" 
              max="0.1" 
              step="0.001" 
              value={outerOffset}
              onChange={(e) => setOuterOffset(parseFloat(e.target.value))}
              style={{ width: '100%' }}
            />
          </div>
          
          <div style={{ marginBottom: '8px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <input 
                type="checkbox" 
                checked={showHdrBackground}
                onChange={(e) => setShowHdrBackground(e.target.checked)}
              />
              <span>显示 HDR 背景</span>
            </label>
          </div>
        </div>
        
        {/* 滚动控制参数（新增） */}
        <div style={{ marginBottom: '16px', padding: '8px', background: 'rgba(255, 193, 7, 0.1)', borderRadius: '4px' }}>
          <div style={{ fontWeight: 'bold', marginBottom: '8px', color: '#FFC107' }}>滚动控制</div>
          
          <div style={{ marginBottom: '8px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <input 
                type="checkbox" 
                checked={enableScrollControl}
                onChange={(e) => setEnableScrollControl(e.target.checked)}
              />
              <span>启用滚动控制</span>
            </label>
          </div>
          
          <div style={{ marginBottom: '8px' }}>
            <div style={{ marginBottom: '4px' }}>基础速度: {baseSpeed.toFixed(2)}</div>
            <input 
              type="range" 
              min="0" 
              max="2" 
              step="0.01" 
              value={baseSpeed}
              onChange={(e) => setBaseSpeed(parseFloat(e.target.value))}
              style={{ width: '100%' }}
            />
          </div>
          
          <div style={{ marginBottom: '8px' }}>
            <div style={{ marginBottom: '4px' }}>速度放大系数: {speedMultiplier.toFixed(1)}</div>
            <input 
              type="range" 
              min="0" 
              max="10" 
              step="0.1" 
              value={speedMultiplier}
              onChange={(e) => setSpeedMultiplier(parseFloat(e.target.value))}
              style={{ width: '100%' }}
            />
          </div>
          
          <div style={{ marginBottom: '8px' }}>
            <div style={{ marginBottom: '4px' }}>外部速度: {externalVelocity.toFixed(2)}</div>
            <input 
              type="range" 
              min="-2" 
              max="2" 
              step="0.01" 
              value={externalVelocity}
              onChange={(e) => setExternalVelocity(parseFloat(e.target.value))}
              style={{ width: '100%' }}
            />
          </div>
        </div>
        
        <div style={{ fontSize: '10px', opacity: 0.8, marginTop: '8px', borderTop: '1px solid #333', paddingTop: '8px' }}>
          <div>• 内层：{showInnerLayer ? '自发光层' : '隐藏'}</div>
          <div>• 外层：{showOuterLayer ? `折射层 (offset: ${outerOffset.toFixed(3)})` : '隐藏'}</div>
          <div>• 背景：{showHdrBackground ? 'HDR 贴图' : '纯色 #1f1e1c'}</div>
          <div>• 滚动控制：{enableScrollControl ? `启用 (基础: ${baseSpeed.toFixed(2)}, 放大: ${speedMultiplier.toFixed(1)})` : '禁用'}</div>
        </div>
      </div>

      <JadeV6
        modelPath={MODELS[idx]}
        rotationDurationSec={8}
        direction={1}
        fitToView
        background="#1f1e1c"
        showHdrBackground={showHdrBackground}
        environmentHdrPath="/textures/qwantani_moon_noon_puresky_1k.hdr"
        environmentIntensity={1.4}
        
        // 滚动控制参数（新增）
        enableScrollControl={enableScrollControl}
        baseSpeed={baseSpeed}
        speedMultiplier={speedMultiplier}
        externalVelocity={externalVelocity}
        
        // 内层材质参数
        innerColor={innerColor}
        innerMetalness={innerMetalness}
        innerRoughness={innerRoughness}
        innerTransmission={innerTransmission}
        innerEmissiveColor={innerEmissiveColor}
        innerEmissiveIntensity={innerEmissiveIntensity}
        enableEmissive={enableEmissive}
        innerEnvMapIntensity={innerEnvMapIntensity}
        
        // 图层控制
        showInnerLayer={showInnerLayer}
        showOuterLayer={showOuterLayer}
        outerOffset={outerOffset}
        
        // 外层材质参数
        outerColor={outerColor}
        outerMetalness={outerMetalness}
        outerRoughness={outerRoughness}
        outerTransmission={outerTransmission}
        outerIor={outerIor}
        outerReflectivity={outerReflectivity}
        outerThickness={outerThickness}
        outerClearcoat={outerClearcoat}
        outerClearcoatRoughness={outerClearcoatRoughness}
        outerEnvMapIntensity={outerEnvMapIntensity}
        normalScale={0.3}
        normalRepeat={3}
        
        // 几何体优化（外壳细分）
        maxEdge={maxEdge}
        subdivisions={subdivisions}
        creaseAngle={creaseAngle}
        
        // 平滑着色控制
        smoothShading={smoothShading}
        innerSmoothShading={innerSmoothShading}
        outerSmoothShading={outerSmoothShading}
        
        enableRotation={true}
      />
    </div>
  );
}


