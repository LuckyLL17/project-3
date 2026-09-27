import { useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Html, Line, OrbitControls, Sky, Text } from '@react-three/drei';
import * as THREE from 'three';

type Status = '进行中' | '已救援' | '失败' | '暂停';
type Snapshot = { x: number; y: number; z: number; stamina: number; temperature: number; rope: number; anchors: number; connected: boolean; evacuating: boolean; vx: number; vz: number; elapsed: number; status: Status; message: string };
type Command = 'anchor' | 'rescue' | 'tighten' | 'restart' | 'pause' | null;
const VICTIM = new THREE.Vector3(5.2, 1.2, -4.8);
const START = new THREE.Vector3(-5.2, 1.05, 5.4);
const SAFE_CENTER = new THREE.Vector3(-5.2, 0, 5.4);
const SAFE_RADIUS = 2.6;
const INTERACT_RADIUS = 2.05;
const TETHER_GAP = 1.5;

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

function SafeZone() {
  return <group position={[SAFE_CENTER.x, 0, SAFE_CENTER.z]}>
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, .04, 0]}><ringGeometry args={[SAFE_RADIUS - .22, SAFE_RADIUS, 72]} /><meshBasicMaterial color="#7fe0ae" transparent opacity={.55} /></mesh>
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, .035, 0]}><circleGeometry args={[SAFE_RADIUS - .22, 72]} /><meshBasicMaterial color="#3a9d78" transparent opacity={.13} /></mesh>
    <mesh position={[SAFE_RADIUS - .55, .9, 0]} castShadow><cylinderGeometry args={[.04, .055, 1.8, 8]} /><meshStandardMaterial color="#3f6b54" metalness={.3} /></mesh>
    <mesh position={[SAFE_RADIUS - .2, 1.52, 0]}><planeGeometry args={[.62, .36]} /><meshStandardMaterial color="#76ddb0" side={THREE.DoubleSide} /></mesh>
    <Html position={[0, 2.25, 0]} center distanceFactor={11}><span className="safe-tag">安全区 · 出发点（带受困者返回此处）</span></Html>
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

type VictimState = 'waiting' | 'evacuating' | 'rescued';

function Victim({ position, state }: { position: THREE.Vector3; state: VictimState }) {
  return <group position={position} rotation={[0, -.5, 0]}>
    {state !== 'rescued' && <><mesh position={[0, .35, 0]} rotation={[0, 0, .2]} castShadow><capsuleGeometry args={[.22, .75, 5, 10]} /><meshStandardMaterial color="#f0a54e" /></mesh><mesh position={[0, .82, 0]}><sphereGeometry args={[.25, 14, 10]} /><meshStandardMaterial color="#e0b18a" /></mesh><Html position={[0, 1.4, 0]} center><span className={state === 'evacuating' ? 'evac-tag' : 'victim-tag'}>{state === 'evacuating' ? '受困者 · 撤离中（主绳连接）' : '受困者 · 需要救援'}</span></Html></>}
    {state === 'rescued' && <Html position={[0, .8, 0]} center><span className="rescued-tag">✓ 已安全送达</span></Html>}
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
  const evacuating = useRef(false);
  const victimPos = useRef(VICTIM.clone());
  const elapsed = useRef(0);
  const lastSnapshot = useRef(0);
  const status = useRef<Status>('进行中');
  const message = useRef('沿雪坡前进，建立安全锚点后靠近受困者，按 E 连接主绳，再护送他撤回出发点安全区。');
  const [renderPosition, setRenderPosition] = useState(START.clone());
  const [renderHeading, setRenderHeading] = useState(0);
  const [renderAnchors, setRenderAnchors] = useState<THREE.Vector3[]>([]);
  const [renderConnected, setRenderConnected] = useState(false);
  const [renderEvacuating, setRenderEvacuating] = useState(false);
  const [renderVictimPos, setRenderVictimPos] = useState(VICTIM.clone());

  useFrame((_, delta) => {
    elapsed.current += delta;
    const command = commandRef.current;
    if (command) {
      commandRef.current = null;
      if (command === 'restart') {
        player.current.copy(START);
        stamina.current = 82; temperature.current = 74; rope.current = 10;
        anchors.current = [];
        connected.current = false; evacuating.current = false;
        victimPos.current.copy(VICTIM);
        elapsed.current = 0; lastSnapshot.current = 0;
        status.current = '进行中';
        message.current = '重新开始：先建立锚点、靠近受困者按 E 连接主绳，再护送其返回安全区。';
      } else if (command === 'pause') {
        if (status.current === '进行中') status.current = '暂停';
      } else if (status.current === '进行中') {
        if (command === 'anchor') {
          if (evacuating.current) message.current = '撤离途中无法新增锚点，请专心护送受困者返回安全区。';
          else if (stamina.current > 12 && anchors.current.length < 3) { anchors.current = [...anchors.current, player.current.clone()]; stamina.current -= 8; rope.current = Math.max(4, rope.current - 2); message.current = '冰镐已打入雪壁，安全锚点建立。'; }
          else message.current = '无法建立更多锚点：体力不足或锚点已达上限。';
        }
        if (command === 'tighten') {
          if (evacuating.current) message.current = '撤离途中无法收紧绳索，保持节奏尽快返回安全区。';
          else if (anchors.current.length) { rope.current = Math.max(2, rope.current - 1.5); message.current = '正在收紧救援绳索，下降路线更稳定。'; }
          else message.current = '请先建立至少一个冰镐锚点。';
        }
        if (command === 'rescue') {
          const distance = player.current.distanceTo(VICTIM);
          if (evacuating.current) {
            const remain = Math.max(0, victimPos.current.distanceTo(SAFE_CENTER) - SAFE_RADIUS);
            message.current = remain > 0
              ? `撤离中：带着受困者继续返回出发点安全区，还差 ${remain.toFixed(1)} m，途中体力、体温和绳长仍会持续消耗！`
              : '已抵达安全区边缘，继续前进，把受困者带入绿色圈内。';
          } else if (distance >= INTERACT_RADIUS) {
            message.current = `尚未靠近受困者（还差 ${Math.max(0, distance - INTERACT_RADIUS).toFixed(1)} m），请先走到受困者身边再按 E。`;
          } else if (anchors.current.length === 0) {
            message.current = '已靠近受困者，但必须先按 Q 打入至少一个冰镐锚点，才能按 E 连接主绳。';
          } else if (!connected.current) {
            connected.current = true; evacuating.current = true;
            message.current = '主绳已连接受困者，进入撤离阶段！护送他返回出发点安全区才算成功，途中体力、体温和绳长继续消耗，资源耗尽仍会失败。';
          }
        }
      }
    }
    if (status.current !== '进行中') return;

    const input = new THREE.Vector3((keys.current.d || keys.current.arrowright ? 1 : 0) - (keys.current.a || keys.current.arrowleft ? 1 : 0), 0, (keys.current.s || keys.current.arrowdown ? 1 : 0) - (keys.current.w || keys.current.arrowup ? 1 : 0));
    const moving = input.lengthSq() > 0;
    if (moving) {
      input.normalize();
      const sprint = keys.current.shift && stamina.current > 1 && !evacuating.current;
      const speed = evacuating.current ? 1.7 : sprint ? 3.9 : 2.25;
      player.current.x = THREE.MathUtils.clamp(player.current.x + input.x * speed * delta, -10.2, 10.2);
      player.current.z = THREE.MathUtils.clamp(player.current.z + input.z * speed * delta, -8.2, 8.2);
      heading.current = Math.atan2(input.x, input.z);
      const staminaRate = evacuating.current ? 6.5 : sprint ? 13 : 4;
      stamina.current = THREE.MathUtils.clamp(stamina.current - staminaRate * delta, 0, 100);
      if (sprint && stamina.current <= 1) message.current = '体力耗尽，停止冲刺。';
    } else {
      stamina.current = THREE.MathUtils.clamp(stamina.current + (evacuating.current ? 1.2 : 2.2) * delta, 0, 100);
    }
    const temperatureRate = evacuating.current ? (moving ? .55 : .4) : moving ? .34 : .22;
    temperature.current = THREE.MathUtils.clamp(temperature.current - temperatureRate * delta, 0, 100);
    if (player.current.distanceTo(SAFE_CENTER) < 2.4) temperature.current = THREE.MathUtils.clamp(temperature.current + .3 * delta, 0, 100);

    // 撤离阶段：受困者通过主绳被拖在救援员身后，按其移动距离消耗绳长
    if (evacuating.current) {
      const before = victimPos.current.clone();
      const offset = new THREE.Vector3(victimPos.current.x - player.current.x, 0, victimPos.current.z - player.current.z);
      const gap = offset.length();
      if (gap > TETHER_GAP) {
        offset.normalize();
        const target = new THREE.Vector3(player.current.x + offset.x * TETHER_GAP, VICTIM.y, player.current.z + offset.z * TETHER_GAP);
        victimPos.current.lerp(target, Math.min(1, delta * 8));
        victimPos.current.y = VICTIM.y;
      }
      rope.current = Math.max(0, rope.current - before.distanceTo(victimPos.current) * .22);
    }

    // 成功判定：受困者被带入出发点安全区
    if (evacuating.current && victimPos.current.distanceTo(SAFE_CENTER) <= SAFE_RADIUS) {
      evacuating.current = false;
      status.current = '已救援';
      message.current = '受困者已安全送达出发点，救援成功！';
    } else if (evacuating.current && rope.current <= 0) {
      status.current = '失败';
      message.current = '救援绳已耗尽，受困者与主绳脱连，救援行动失败。';
    } else if (temperature.current <= 0 || stamina.current <= 0) {
      status.current = '失败';
      message.current = temperature.current <= 0
        ? (evacuating.current ? '撤离途中体温过低，队员与受困者均无法继续，救援失败。' : '体温过低，救援行动失败。')
        : (evacuating.current ? '撤离途中体力耗尽，无法继续护送受困者，救援失败。' : '体力耗尽，无法继续攀登。');
    }

    setRenderPosition(player.current.clone()); setRenderHeading(heading.current); setRenderAnchors(anchors.current.map(point => point.clone()));
    setRenderConnected(connected.current); setRenderEvacuating(evacuating.current); setRenderVictimPos(victimPos.current.clone());
    if (elapsed.current - lastSnapshot.current > .12) { lastSnapshot.current = elapsed.current; onSnapshot({ x: player.current.x, y: player.current.y, z: player.current.z, stamina: stamina.current, temperature: temperature.current, rope: rope.current, anchors: anchors.current.length, connected: connected.current, evacuating: evacuating.current, vx: victimPos.current.x, vz: victimPos.current.z, elapsed: elapsed.current, status: status.current, message: message.current }); }
  });

  const victimState: VictimState = !renderConnected ? 'waiting' : renderEvacuating ? 'evacuating' : 'rescued';
  const ropeTarget = renderConnected ? renderVictimPos : VICTIM;
  const ropeColor = !renderConnected ? '#d8e3df' : renderEvacuating ? '#f4d485' : '#73dca2';
  const ropePoints = [renderPosition.clone().add(new THREE.Vector3(0, .55, 0)), ...renderAnchors.map(point => point.clone().add(new THREE.Vector3(0, .3, 0))), ropeTarget.clone().add(new THREE.Vector3(0, .3, 0))];
  return <><Sky distance={450} sunPosition={[-10, 8, -10]} inclination={.52} azimuth={.23} /><ambientLight intensity={1.1} /><directionalLight position={[-5, 10, 3]} intensity={2.5} castShadow shadow-mapSize={[1024, 1024]} /><hemisphereLight color="#d7f5ff" groundColor="#6d8a95" intensity={.8} /><Mountain /><SnowGround /><SafeZone /><CableLine /><Tower position={[-8, 0, 5]} height={6.2} /><Tower position={[8, 0, -4]} height={6.8} /><CableCar /><Player position={renderPosition} heading={renderHeading} /><Victim position={renderVictimPos} state={victimState} /><Anchors positions={renderAnchors} />{ropePoints.length > 1 && <Line points={ropePoints} color={ropeColor} lineWidth={1.6} dashed={false} />}<OrbitControls enablePan={false} minDistance={10} maxDistance={25} maxPolarAngle={Math.PI / 2.05} target={[0, 1, 0]} /> </>;
}

function Meter({ label, value, color, suffix = '%' }: { label: string; value: number; color: string; suffix?: string }) { return <div className="meter"><div className="meter-head"><span>{label}</span><b>{Math.round(value)}{suffix}</b></div><div className="meter-track"><i style={{ width: `${Math.max(0, Math.min(100, value))}%`, background: color }} /></div></div>; }

export default function App() {
  const commandRef = useRef<Command>(null);
  const [snapshot, setSnapshot] = useState<Snapshot>({ x: START.x, y: START.y, z: START.z, stamina: 82, temperature: 74, rope: 10, anchors: 0, connected: false, evacuating: false, vx: VICTIM.x, vz: VICTIM.z, elapsed: 0, status: '进行中', message: '沿雪坡前进，建立安全锚点后靠近受困者，按 E 连接主绳，再护送他撤回出发点安全区。' });
  const issue = (command: Command) => { commandRef.current = command; };
  const victimDist = Math.hypot(snapshot.x - VICTIM.x, snapshot.z - VICTIM.z);
  const safeRemain = Math.max(0, Math.hypot(snapshot.vx - SAFE_CENTER.x, snapshot.vz - SAFE_CENTER.z) - SAFE_RADIUS);
  const atSafeZone = Math.hypot(snapshot.x - SAFE_CENTER.x, snapshot.z - SAFE_CENTER.z) <= SAFE_RADIUS;

  const eHint = (() => {
    if (snapshot.status === '已救援') return '受困者已安全抵达出发点，救援任务完成。';
    if (snapshot.status === '失败') return '救援行动已经失败，请点击「重新开始任务」。';
    if (snapshot.status === '暂停') return '行动已暂停，可点击「重新开始任务」重新部署。';
    if (snapshot.evacuating) {
      return safeRemain > 0
        ? `【撤离中】主绳已连接，请护送受困者返回出发点绿色安全区，还差 ${safeRemain.toFixed(1)} m；途中体力、体温和绳长持续消耗，耗尽即失败。`
        : '【到达安全区】受困者已在安全区边缘，继续前进将其带入绿色圈内即可完成救援。';
    }
    if (snapshot.anchors === 0) {
      if (victimDist < INTERACT_RADIUS) return '【已靠近受困者】还没有锚点：请先按 Q 打入冰镐锚点，再按 E 连接主绳。';
      if (atSafeZone) return '【出发点安全区】受困者尚未连接：请离开安全区前往受困者位置，沿途按 Q 至少建立一个锚点。';
      return `【尚未靠近受困者】当前相距 ${victimDist.toFixed(1)} m，请沿途按 Q 至少建立一个锚点，再走到受困者身边按 E。`;
    }
    if (victimDist >= INTERACT_RADIUS) return `【尚未靠近受困者】锚点已就绪，还差 ${Math.max(0, victimDist - INTERACT_RADIUS).toFixed(1)} m，靠近后按 E 连接主绳。`;
    return '【已靠近受困者】锚点就绪：按 E 连接主绳，随后护送受困者撤离。';
  })();

  return <div className="game-shell"><header className="topbar"><div><span className="eyebrow">ALPINE RESCUE / MISSION 07</span><h1>雪山缆车救援行动</h1></div><div className="mission-status"><span className={snapshot.status === '进行中' ? 'live-dot' : snapshot.status === '已救援' ? 'success-dot' : 'status-dot'} />{snapshot.status}<span className="mission-time">{Math.floor(snapshot.elapsed / 60).toString().padStart(2, '0')}:{Math.floor(snapshot.elapsed % 60).toString().padStart(2, '0')}</span></div></header><main className="game-layout"><section className="viewport-card"><div className="scene"><Canvas shadows camera={{ position: [11, 9, 13], fov: 42 }}><GameScene commandRef={commandRef} onSnapshot={setSnapshot} /></Canvas><div className="controls-hint"><span>WASD / 方向键 移动</span><span>Shift 冲刺</span><span>拖拽旋转视角</span></div><div className="crosshair">＋</div></div></section><aside className="hud"><section className="objective"><div className="section-kicker">当前任务 / RESCUE OBJECTIVE</div><h2>连接受困者并护送其撤回出发点安全区</h2><div className="objective-row"><span className={snapshot.connected || victimDist < INTERACT_RADIUS ? 'check done' : 'check'}>{snapshot.connected || victimDist < INTERACT_RADIUS ? '✓' : '○'}</span><span>接近受困者 <b>{victimDist.toFixed(1)} m</b></span></div><div className="objective-row"><span className={snapshot.anchors > 0 ? 'check done' : 'check'}>{snapshot.anchors > 0 ? '✓' : '○'}</span><span>建立安全锚点 <b>{snapshot.anchors}/3</b></span></div><div className="objective-row"><span className={snapshot.connected ? 'check done' : 'check'}>{snapshot.connected ? '✓' : '○'}</span><span>按 E 连接主绳 <b>{snapshot.connected ? '已连接' : '未连接'}</b></span></div><div className="objective-row"><span className={snapshot.status === '已救援' ? 'check done' : 'check'}>{snapshot.status === '已救援' ? '✓' : '○'}</span><span>护送回出发点安全区{snapshot.evacuating ? <b>还差 {safeRemain.toFixed(1)} m</b> : snapshot.status === '已救援' ? <b>已送达</b> : <b>待撤离</b>}</span></div></section><section className="vitals"><div className="section-kicker">救援员状态 / VITALS</div><Meter label="体力 STAMINA" value={snapshot.stamina} color="#78d8a1" /><Meter label="体温 BODY TEMP" value={snapshot.temperature} color={snapshot.temperature < 30 ? '#ed7968' : '#75cfee'} /></section><section className="equipment"><div className="section-kicker">装备与绳索 / GEAR</div><div className="gear-row"><div className="gear-icon">⛏</div><div><b>冰镐锚点</b><small>用于固定救援路线</small></div><strong>{snapshot.anchors}/3</strong></div><div className="gear-row"><div className="gear-icon rope-icon">⌁</div><div><b>救援绳</b><small>{snapshot.evacuating ? '撤离中持续消耗' : '剩余可用长度'}</small></div><strong>{snapshot.rope.toFixed(1)} m</strong></div></section><section className="actions"><div className="section-kicker">操作 / ACTIONS</div><div className={`context-hint ${snapshot.evacuating ? 'evac' : ''}`}><span className="hint-key">E</span>{eHint}</div><div className="action-grid"><button onClick={() => issue('anchor')} disabled={snapshot.status !== '进行中'}><span>Q</span>打入冰镐锚点</button><button onClick={() => issue('rescue')} disabled={snapshot.status !== '进行中'}><span>E</span>{snapshot.evacuating ? '撤离中 · 返回安全区' : '连接受困者'}</button><button onClick={() => issue('tighten')} disabled={snapshot.status !== '进行中'}><span>R</span>收紧救援绳</button><button onClick={() => issue('pause')} disabled={snapshot.status !== '进行中'}><span>Esc</span>暂停行动</button></div></section><div className={`mission-message ${snapshot.status === '失败' ? 'danger' : snapshot.status === '已救援' ? 'success' : snapshot.evacuating ? 'warning' : ''}`}><span>◈</span>{snapshot.message}</div><button className="restart" onClick={() => issue('restart')}>重新开始任务</button></aside></main><footer className="footer"><span>风速 32 km/h · 体感 -18°C · 能见度 420 m</span><span>局部雪崩警报：中等</span></footer></div>;
}
