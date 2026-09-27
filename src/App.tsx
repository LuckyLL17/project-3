import { useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Html, Line, OrbitControls, Sky, Text } from '@react-three/drei';
import * as THREE from 'three';

type Status = '进行中' | '撤离中' | '已救援' | '失败' | '暂停';
type Snapshot = { x: number; y: number; z: number; stamina: number; temperature: number; rope: number; anchors: number; connected: boolean; rescued: boolean; elapsed: number; status: Status; message: string };
type Command = 'anchor' | 'rescue' | 'tighten' | 'restart' | 'pause' | null;
const VICTIM = new THREE.Vector3(5.2, 1.2, -4.8);
const START = new THREE.Vector3(-5.2, 1.05, 5.4);
const SAFE_RADIUS = 2.3;

function useKeys() {
  const keys = useRef<Record<string, boolean>>({});
  useEffect(() => {
    const down = (event: KeyboardEvent) => { keys.current[event.key.toLowerCase()] = true; if ([' ', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(event.key.toLowerCase())) event.preventDefault(); };
    const up = (event: KeyboardEvent) => { keys.current[event.key.toLowerCase()] = false; };
    window.addEventListener('keydown', down); window.addEventListener('keyup', up);
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); };
  }, []);
  return keys;
}

function SnowGround() {
  const rocks = useMemo(() => [
    [-5, .35, 1.4, .55], [-2.3, .3, -2, .42], [0.8, .35, 2.7, .6], [3, .28, -1.2, .42], [6, .4, 2.2, .7], [7, .3, -5.6, .5], [-7, .32, -4.2, .58]
  ], []);
  return <group>
    <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow><planeGeometry args={[25, 22, 32, 32]} /><meshStandardMaterial color="#c8d9e0" roughness={.95} /></mesh>
    <mesh position={[0, -.18, 0]} receiveShadow><boxGeometry args={[24, .3, 21]} /><meshStandardMaterial color="#a8c4cf" /></mesh>
    {rocks.map(([x, scale, z, radius], index) => <mesh key={index} position={[x, radius * .55, z]} scale={[1.2, .75, .9]} castShadow><dodecahedronGeometry args={[radius, 1]} /><meshStandardMaterial color={index % 2 ? '#e7f2f4' : '#b6cfd8'} roughness={1} /></mesh>)}
    <mesh position={[0, .04, -1.5]} rotation={[-Math.PI / 2, 0, 0]}><ringGeometry args={[5.7, 6, 64]} /><meshBasicMaterial color="#e6f4f5" transparent opacity={.22} /></mesh>
  </group>;
}

function Mountain() {
  return <group>
    <mesh position={[-8, 2.3, -5]} rotation={[0, .35, -.1]} castShadow><coneGeometry args={[5.8, 7.8, 5]} /><meshStandardMaterial color="#6f8f9c" roughness={1} /></mesh>
    <mesh position={[9, 2.8, -3]} rotation={[0, -.5, .05]} castShadow><coneGeometry args={[6.2, 9, 5]} /><meshStandardMaterial color="#5e7e8d" roughness={1} /></mesh>
    <mesh position={[-8.1, 6, -5.1]} rotation={[0, .35, -.1]}><coneGeometry args={[1.5, 2.2, 5]} /><meshStandardMaterial color="#eff8f7" /></mesh>
    <mesh position={[9.1, 7, -3.1]} rotation={[0, -.5, .05]}><coneGeometry args={[1.7, 2.6, 5]} /><meshStandardMaterial color="#edf7f6" /></mesh>
  </group>;
}

function CableLine() {
  const points = useMemo(() => [new THREE.Vector3(-8, 8.3, 5), new THREE.Vector3(0, 10, 0), new THREE.Vector3(8, 9, -4)], []);
  return <Line points={points} color="#304b55" lineWidth={2.2} />;
}

function Tower({ position, height = 5 }: { position: [number, number, number]; height?: number }) {
  return <group position={position}>
    <mesh position={[0, height / 2, 0]} castShadow><cylinderGeometry args={[.1, .15, height, 6]} /><meshStandardMaterial color="#455f68" metalness={.6} roughness={.45} /></mesh>
    <mesh position={[0, height, 0]}><boxGeometry args={[1.8, .12, .35]} /><meshStandardMaterial color="#425d67" metalness={.7} /></mesh>
    {[-.7, .7].map(x => <mesh key={x} position={[x, height / 2, 0]} rotation={[0, 0, x < 0 ? -.18 : .18]}><cylinderGeometry args={[.045, .045, height, 6]} /><meshStandardMaterial color="#6f8991" /></mesh>)}
  </group>;
}

function CableCar() {
  return <group position={[-.4, 8.25, 1]}>
    <mesh position={[0, -.75, 0]}><boxGeometry args={[2.5, 1.35, 1.35]} /><meshStandardMaterial color="#d95b43" metalness={.2} roughness={.4} /></mesh>
    <mesh position={[0, -.35, 0]}><boxGeometry args={[2.15, .7, 1.05]} /><meshStandardMaterial color="#bde9ec" transparent opacity={.72} /></mesh>
    {[-.82, .82].map(x => <mesh key={x} position={[x, -1.45, 0]}><cylinderGeometry args={[.14, .14, .12, 12]} /><meshStandardMaterial color="#263c42" /></mesh>)}
    <Text position={[0, -1.62, 0]} fontSize={.22} color="#fff4de" anchorX="center">CABLE 07</Text>
  </group>;
}

function Player({ position, heading }: { position: THREE.Vector3; heading: number }) {
  return <group position={position} rotation={[0, heading, 0]}>
    <mesh position={[0, .52, 0]} castShadow><capsuleGeometry args={[.22, .62, 5, 10]} /><meshStandardMaterial color="#d56b45" /></mesh>
    <mesh position={[0, 1.18, 0]} castShadow><sphereGeometry args={[.27, 16, 12]} /><meshStandardMaterial color="#f0c29a" /></mesh>
    <mesh position={[0, 1.2, .02]}><sphereGeometry args={[.28, 16, 8]} /><meshStandardMaterial color="#27383d" /></mesh>
    <mesh position={[-.28, .65, .02]} rotation={[0, 0, -.65]}><boxGeometry args={[.06, .65, .08]} /><meshStandardMaterial color="#2d5660" /></mesh>
    <mesh position={[.28, .65, .02]} rotation={[0, 0, .65]}><boxGeometry args={[.06, .65, .08]} /><meshStandardMaterial color="#2d5660" /></mesh>
    <Html position={[0, 1.65, 0]} center distanceFactor={9}><span className="player-tag">救援员</span></Html>
  </group>;
}

function Victim({ position, connected, rescued }: { position: THREE.Vector3; connected: boolean; rescued: boolean }) {
  return <group position={position} rotation={[0, -.5, 0]}>
    <mesh position={[0, .35, 0]} rotation={[0, 0, connected ? 0 : .2]} castShadow><capsuleGeometry args={[.22, .75, 5, 10]} /><meshStandardMaterial color="#f0a54e" /></mesh>
    <mesh position={[0, .82, 0]}><sphereGeometry args={[.25, 14, 10]} /><meshStandardMaterial color="#e0b18a" /></mesh>
    <Html position={[0, 1.4, 0]} center><span className={rescued ? 'rescued-tag' : 'victim-tag'}>{rescued ? '✓ 已获救' : connected ? '受困者 · 撤离中' : '受困者 · 需要救援'}</span></Html>
  </group>;
}

function SafeZone() {
  return <group position={[START.x, 0, START.z]}>
    <mesh position={[0, .05, 0]} rotation={[-Math.PI / 2, 0, 0]}><ringGeometry args={[1.82, SAFE_RADIUS, 48]} /><meshBasicMaterial color="#8fe6b0" transparent opacity={.6} /></mesh>
    <mesh position={[0, .045, 0]} rotation={[-Math.PI / 2, 0, 0]}><circleGeometry args={[1.82, 48]} /><meshBasicMaterial color="#8fe6b0" transparent opacity={.12} /></mesh>
    <Html position={[0, 1.15, 0]} center><span className="safe-tag">安全区 · 出发点</span></Html>
  </group>;
}

function Anchors({ positions }: { positions: THREE.Vector3[] }) { return <>{positions.map((position, index) => <group key={`${position.x}-${position.z}-${index}`} position={position}><mesh position={[0, .25, 0]}><cylinderGeometry args={[.13, .18, .5, 8]} /><meshStandardMaterial color="#dfbd62" metalness={.5} /></mesh><Html position={[0, .65, 0]} center><span className="anchor-tag">锚点 {index + 1}</span></Html></group>)}</>; }

function GameScene({ commandRef, onSnapshot }: { commandRef: React.MutableRefObject<Command>; onSnapshot: (snapshot: Snapshot) => void }) {
  const keys = useKeys();
  const player = useRef(START.clone());
  const heading = useRef(0);
  const stamina = useRef(82);
  const temperature = useRef(74);
  const rope = useRef(10);
  const anchors = useRef<THREE.Vector3[]>([]);
  const connected = useRef(false);
  const victimPos = useRef(VICTIM.clone());
  const elapsed = useRef(0);
  const lastSnapshot = useRef(0);
  const status = useRef<Status>('进行中');
  const resumeStatus = useRef<Status>('进行中');
  const message = useRef('沿雪坡前进，找到受困者并建立安全锚点。');
  const [renderPosition, setRenderPosition] = useState(START.clone());
  const [renderHeading, setRenderHeading] = useState(0);
  const [renderAnchors, setRenderAnchors] = useState<THREE.Vector3[]>([]);
  const [renderVictim, setRenderVictim] = useState(VICTIM.clone());
  const [renderConnected, setRenderConnected] = useState(false);
  const [renderRescued, setRenderRescued] = useState(false);

  const emitSnapshot = () => onSnapshot({ x: player.current.x, y: player.current.y, z: player.current.z, stamina: stamina.current, temperature: temperature.current, rope: rope.current, anchors: anchors.current.length, connected: connected.current, rescued: status.current === '已救援', elapsed: elapsed.current, status: status.current, message: message.current });
  const syncRender = () => { setRenderPosition(player.current.clone()); setRenderHeading(heading.current); setRenderAnchors(anchors.current.map(point => point.clone())); setRenderVictim(victimPos.current.clone()); setRenderConnected(connected.current); setRenderRescued(status.current === '已救援'); };

  useFrame((_, delta) => {
    const command = commandRef.current;
    if (command) {
      commandRef.current = null;
      if (command === 'restart') {
        player.current.copy(START); heading.current = 0; stamina.current = 82; temperature.current = 74; rope.current = 10;
        anchors.current = []; connected.current = false; victimPos.current.copy(VICTIM); elapsed.current = 0;
        status.current = '进行中'; message.current = '重新开始救援：先建立锚点，靠近受困者后按 E 连接。';
      } else if (command === 'pause') {
        if (status.current === '暂停') { status.current = resumeStatus.current; message.current = '继续行动。'; }
        else if (status.current === '进行中' || status.current === '撤离中') { resumeStatus.current = status.current; status.current = '暂停'; message.current = '行动已暂停，按 Esc 继续。'; }
      } else if (status.current === '进行中' || status.current === '撤离中') {
        if (command === 'anchor') {
          if (stamina.current > 12 && anchors.current.length < 3) { anchors.current = [...anchors.current, player.current.clone()]; stamina.current -= 8; rope.current = Math.max(4, rope.current - 2); message.current = '冰镐已打入雪壁，安全锚点建立。'; } else message.current = '无法建立更多锚点：体力不足或锚点已达上限。';
        }
        if (command === 'tighten') { if (anchors.current.length) { rope.current = Math.max(2, rope.current - 1.5); message.current = '正在收紧救援绳索，下降路线更稳定。'; } else message.current = '请先建立至少一个冰镐锚点。'; }
        if (command === 'rescue') {
          if (connected.current) message.current = '正在撤离中：护送受困者返回出发点的绿色安全区。';
          else {
            const distance = Math.hypot(player.current.x - VICTIM.x, player.current.z - VICTIM.z);
            if (distance >= 2.05) message.current = `还未靠近受困者：还差 ${(distance - 2.05).toFixed(1)} m，继续接近后再按 E。`;
            else if (anchors.current.length === 0) message.current = '还没有安全锚点：先按 Q 打入至少一个冰镐锚点。';
            else { connected.current = true; status.current = '撤离中'; message.current = '已连接受困者！撤离开始——带他返回出发点安全区，注意体力、体温和绳长。'; }
          }
        }
      }
      emitSnapshot();
      syncRender();
    }
    if (status.current === '暂停' || status.current === '已救援' || status.current === '失败') return;
    elapsed.current += delta;
    const evacuating = status.current === '撤离中';
    const input = new THREE.Vector3((keys.current.d || keys.current.arrowright ? 1 : 0) - (keys.current.a || keys.current.arrowleft ? 1 : 0), 0, (keys.current.s || keys.current.arrowdown ? 1 : 0) - (keys.current.w || keys.current.arrowup ? 1 : 0));
    const moving = input.lengthSq() > 0;
    if (moving) {
      input.normalize();
      const sprint = keys.current.shift && stamina.current > 1;
      const speed = (sprint ? 3.9 : 2.25) * (evacuating ? .82 : 1);
      player.current.x = THREE.MathUtils.clamp(player.current.x + input.x * speed * delta, -10.2, 10.2);
      player.current.z = THREE.MathUtils.clamp(player.current.z + input.z * speed * delta, -8.2, 8.2);
      heading.current = Math.atan2(input.x, input.z);
      stamina.current = THREE.MathUtils.clamp(stamina.current + (sprint ? -13 : -4) * (evacuating ? 1.4 : 1) * delta, 0, 100);
      if (sprint && stamina.current <= 1) message.current = '体力耗尽，停止冲刺。';
    } else stamina.current = THREE.MathUtils.clamp(stamina.current + 2.2 * delta, 0, 100);
    temperature.current = THREE.MathUtils.clamp(temperature.current - (moving ? .34 : .22) * delta, 0, 100);
    if (player.current.distanceTo(new THREE.Vector3(-5, 0, 5)) < 2.1) temperature.current = THREE.MathUtils.clamp(temperature.current + .3 * delta, 0, 100);
    if (evacuating) {
      const toPlayer = new THREE.Vector3().subVectors(player.current, victimPos.current); toPlayer.y = 0;
      const gap = toPlayer.length();
      if (gap > 1.05) victimPos.current.addScaledVector(toPlayer.normalize(), (gap - 1.05) * Math.min(1, delta * 6));
      rope.current = Math.max(0, rope.current - (moving ? .5 : .28) * delta);
      if (Math.hypot(player.current.x - START.x, player.current.z - START.z) < SAFE_RADIUS) { status.current = '已救援'; message.current = '到达安全区！受困者已成功获救，任务完成。'; }
    }
    if (status.current !== '已救援') {
      if (temperature.current <= 0) { status.current = '失败'; message.current = '体温过低，救援行动失败。'; }
      else if (stamina.current <= 0) { status.current = '失败'; message.current = '体力耗尽，无法继续攀登。'; }
      else if (evacuating && rope.current <= 0) { status.current = '失败'; message.current = '救援绳耗尽，撤离失败。'; }
    }
    syncRender();
    if (elapsed.current - lastSnapshot.current > .12) { lastSnapshot.current = elapsed.current; emitSnapshot(); }
  });
  const ropePoints = [renderPosition.clone().add(new THREE.Vector3(0, .55, 0)), ...renderAnchors.map(point => point.clone().add(new THREE.Vector3(0, .3, 0))), renderVictim.clone().add(new THREE.Vector3(0, .3, 0))];
  return <><Sky distance={450} sunPosition={[-10, 8, -10]} inclination={.52} azimuth={.23} /><ambientLight intensity={1.1} /><directionalLight position={[-5, 10, 3]} intensity={2.5} castShadow shadow-mapSize={[1024, 1024]} /><hemisphereLight color="#d7f5ff" groundColor="#6d8a95" intensity={.8} /><Mountain /><SnowGround /><CableLine /><Tower position={[-8, 0, 5]} height={6.2} /><Tower position={[8, 0, -4]} height={6.8} /><CableCar /><SafeZone /><Player position={renderPosition} heading={renderHeading} /><Victim position={renderVictim} connected={renderConnected} rescued={renderRescued} /><Anchors positions={renderAnchors} />{ropePoints.length > 1 && <Line points={ropePoints} color={renderConnected ? '#f4d485' : '#d8e3df'} lineWidth={1.4} dashed={false} />}<OrbitControls enablePan={false} minDistance={10} maxDistance={25} maxPolarAngle={Math.PI / 2.05} target={[0, 1, 0]} /> </>;
}

function Meter({ label, value, color, suffix = '%' }: { label: string; value: number; color: string; suffix?: string }) { return <div className="meter"><div className="meter-head"><span>{label}</span><b>{Math.round(value)}{suffix}</b></div><div className="meter-track"><i style={{ width: `${Math.max(0, Math.min(100, value))}%`, background: color }} /></div></div>; }

export default function App() {
  const commandRef = useRef<Command>(null);
  const [snapshot, setSnapshot] = useState<Snapshot>({ x: START.x, y: START.y, z: START.z, stamina: 82, temperature: 74, rope: 10, anchors: 0, connected: false, rescued: false, elapsed: 0, status: '进行中', message: '沿雪坡前进，找到受困者并建立安全锚点。' });
  const issue = (command: Command) => { commandRef.current = command; };
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.repeat) return;
      const key = event.key.toLowerCase();
      if (key === 'q') issue('anchor');
      else if (key === 'e') issue('rescue');
      else if (key === 'r') issue('tighten');
      else if (key === 'escape') issue('pause');
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);
  const active = snapshot.status === '进行中' || snapshot.status === '撤离中';
  const distance = Math.hypot(snapshot.x - VICTIM.x, snapshot.z - VICTIM.z);
  const safeDistance = Math.hypot(snapshot.x - START.x, snapshot.z - START.z);
  const hint = snapshot.status === '已救援' ? '✓ 已到达安全区，受困者获救！可点击“重新开始任务”再来一局。'
    : snapshot.status === '失败' ? '任务失败，点击“重新开始任务”再试一次。'
    : snapshot.status === '暂停' ? '行动已暂停，按 Esc 或点击“继续行动”恢复。'
    : snapshot.status === '撤离中' ? `正在撤离：护送受困者返回出发点安全区（还有 ${safeDistance.toFixed(1)} m），留意体力、体温与绳长。`
    : distance >= 2.05 ? `未靠近受困者：还差 ${(distance - 2.05).toFixed(1)} m，继续接近后按 E 连接。`
    : snapshot.anchors === 0 ? '缺少安全锚点：先按 Q 打入至少一个冰镐锚点。'
    : '已就位：按 E 连接救援绳，开始撤离。';
  return <div className="game-shell"><header className="topbar"><div><span className="eyebrow">ALPINE RESCUE / MISSION 07</span><h1>雪山缆车救援行动</h1></div><div className="mission-status"><span className={active ? 'live-dot' : 'status-dot'} />{snapshot.status}<span className="mission-time">{Math.floor(snapshot.elapsed / 60).toString().padStart(2, '0')}:{Math.floor(snapshot.elapsed % 60).toString().padStart(2, '0')}</span></div></header><main className="game-layout"><section className="viewport-card"><div className="scene"><Canvas shadows camera={{ position: [11, 9, 13], fov: 42 }}><GameScene commandRef={commandRef} onSnapshot={setSnapshot} /></Canvas><div className="controls-hint"><span>WASD / 方向键 移动</span><span>Shift 冲刺</span><span>Q 锚点 · E 连接 · R 收绳</span><span>拖拽旋转视角</span></div><div className="crosshair">＋</div></div></section><aside className="hud"><section className="objective"><div className="section-kicker">当前任务 / RESCUE OBJECTIVE</div><h2>连接受困者并护送回出发点安全区</h2><div className="objective-row"><span className={distance < 2.05 || snapshot.connected ? 'check done' : 'check'}>{distance < 2.05 || snapshot.connected ? '✓' : '○'}</span><span>接近受困者 <b>{distance.toFixed(1)} m</b></span></div><div className="objective-row"><span className={snapshot.anchors > 0 ? 'check done' : 'check'}>{snapshot.anchors > 0 ? '✓' : '○'}</span><span>建立安全锚点 <b>{snapshot.anchors}/3</b></span></div><div className="objective-row"><span className={snapshot.connected ? 'check done' : 'check'}>{snapshot.connected ? '✓' : '○'}</span><span>连接主绳（按 E）</span></div><div className="objective-row"><span className={snapshot.rescued ? 'check done' : 'check'}>{snapshot.rescued ? '✓' : '○'}</span><span>护送回安全区{snapshot.status === '撤离中' ? <b>{safeDistance.toFixed(1)} m</b> : null}</span></div></section><section className="vitals"><div className="section-kicker">救援员状态 / VITALS</div><Meter label="体力 STAMINA" value={snapshot.stamina} color="#78d8a1" /><Meter label="体温 BODY TEMP" value={snapshot.temperature} color={snapshot.temperature < 30 ? '#ed7968' : '#75cfee'} /></section><section className="equipment"><div className="section-kicker">装备与绳索 / GEAR</div><div className="gear-row"><div className="gear-icon">⛏</div><div><b>冰镐锚点</b><small>用于固定救援路线</small></div><strong>{snapshot.anchors}/3</strong></div><div className="gear-row"><div className="gear-icon rope-icon">⌁</div><div><b>救援绳</b><small>{snapshot.status === '撤离中' ? '撤离中持续消耗' : '剩余可用长度'}</small></div><strong>{snapshot.rope.toFixed(1)} m</strong></div></section><section className="actions"><div className="section-kicker">操作 / ACTIONS</div><div className="action-grid"><button onClick={() => issue('anchor')} disabled={!active}><span>Q</span>打入冰镐锚点</button><button onClick={() => issue('rescue')} disabled={!active}><span>E</span>{snapshot.connected ? '撤离中…' : '连接受困者'}</button><button onClick={() => issue('tighten')} disabled={!active}><span>R</span>收紧救援绳</button><button onClick={() => issue('pause')} disabled={!active && snapshot.status !== '暂停'}><span>Esc</span>{snapshot.status === '暂停' ? '继续行动' : '暂停行动'}</button></div><div className="action-hint">{hint}</div></section><div className={`mission-message ${snapshot.status === '失败' ? 'danger' : snapshot.status === '已救援' ? 'success' : snapshot.status === '撤离中' ? 'evac' : ''}`}><span>◈</span>{snapshot.message}</div><button className="restart" onClick={() => issue('restart')}>重新开始任务</button></aside></main><footer className="footer"><span>风速 32 km/h · 体感 -18°C · 能见度 420 m</span><span>局部雪崩警报：中等</span></footer></div>;
}
