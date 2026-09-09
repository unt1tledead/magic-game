'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  Aperture,
  Camera,
  ChevronDown,
  Crosshair,
  ExternalLink,
  Flashlight,
  Gauge,
  Image as ImageIcon,
  Maximize2,
  Mic,
  Moon,
  RefreshCw,
  Settings2,
  Shield,
  Signal,
  Sparkles,
  Sun,
  Volume2,
  Wifi,
  X
} from 'lucide-react';

type Status = {
  online: boolean;
  torch: boolean | null;
  battery: number | null;
  width: number | null;
  height: number | null;
  fps: number | null;
  uptime: string | null;
  audio: boolean | null;
  camera: 'front' | 'back' | null;
  raw: unknown;
};

type EventItem = {
  id: number;
  time: string;
  title: string;
  detail: string;
};

const defaultBase = 'http://192.168.1.42:8080';

function normalizeBase(value: string) {
  return value.trim().replace(/\/+$/, '');
}

function parseStatus(payload: any): Status {
  const cur = payload?.curvals ?? payload ?? {};
  const available = payload?.avail ?? {};
  const resolution = cur?.video_size ?? cur?.resolution ?? cur?.video_resolution;
  let width: number | null = null;
  let height: number | null = null;
  if (typeof resolution === 'string') {
    const match = resolution.match(/(\d+)\s*[x×]\s*(\d+)/i);
    if (match) {
      width = Number(match[1]);
      height = Number(match[2]);
    }
  } else if (Array.isArray(resolution) && resolution.length >= 2) {
    width = Number(resolution[0]);
    height = Number(resolution[1]);
  }

  return {
    online: true,
    torch: typeof cur?.torch === 'string' ? cur.torch === 'on' : null,
    battery: Number.isFinite(Number(cur?.battery_level ?? cur?.battery)) ? Number(cur?.battery_level ?? cur?.battery) : null,
    width,
    height,
    fps: Number.isFinite(Number(cur?.fps)) ? Number(cur.fps) : null,
    uptime: cur?.uptime ?? cur?.uptime_sec ?? null,
    audio: typeof cur?.audio === 'string' ? cur.audio !== 'off' : null,
    camera: typeof cur?.ffc === 'string' ? (cur.ffc === 'on' ? 'front' : 'back') : null,
    raw: { cur, available }
  };
}

export default function Home() {
  const [baseUrl, setBaseUrl] = useState(defaultBase);
  const [draftUrl, setDraftUrl] = useState(defaultBase);
  const [connected, setConnected] = useState(false);
  const [status, setStatus] = useState<Status>({ online: false, torch: null, battery: null, width: null, height: null, fps: null, uptime: null, audio: null, camera: null, raw: null });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [motionEnabled, setMotionEnabled] = useState(true);
  const [motionSensitivity, setMotionSensitivity] = useState(42);
  const [lastMotionAt, setLastMotionAt] = useState<string | null>(null);
  const [events, setEvents] = useState<EventItem[]>([]);
  const [fullscreen, setFullscreen] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [signal, setSignal] = useState(3);
  const imgRef = useRef<HTMLImageElement | null>(null);

  const streamUrl = useMemo(() => `${baseUrl}/videofeed`, [baseUrl]);

  const logEvent = (title: string, detail: string) => {
    setEvents((items) => [
      { id: Date.now(), time: new Date().toLocaleTimeString(), title, detail },
      ...items
    ].slice(0, 12));
  };

  const refreshStatus = async () => {
    if (!baseUrl) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${baseUrl}/status.json?show_avail=1`, { cache: 'no-store', mode: 'cors' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const parsed = parseStatus(await res.json());
      setStatus(parsed);
      setConnected(true);
      setSignal((s) => Math.max(1, Math.min(4, s)));
    } catch (e) {
      setConnected(false);
      setStatus((s) => ({ ...s, online: false }));
      setError('Не удалось получить status.json. Проверь IP, порт, Wi‑Fi и CORS/доступ из браузера.');
    } finally {
      setLoading(false);
    }
  };

  const sendCommand = async (path: string, label: string) => {
    setError('');
    try {
      const res = await fetch(`${baseUrl}${path}`, { mode: 'cors', cache: 'no-store' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      logEvent(label, path);
      await refreshStatus();
    } catch {
      setError(`Команду ${path} не удалось выполнить из браузера. Некоторые сборки IP Webcam не разрешают cross-origin запросы.`);
    }
  };

  const connect = async () => {
    const next = normalizeBase(draftUrl);
    setBaseUrl(next);
    await new Promise((r) => setTimeout(r, 0));
    try {
      const res = await fetch(`${next}/status.json?show_avail=1`, { mode: 'cors', cache: 'no-store' });
      if (!res.ok) throw new Error();
      setStatus(parseStatus(await res.json()));
      setConnected(true);
      setError('');
      logEvent('Camera connected', next);
    } catch {
      setConnected(false);
      setError('Камера не ответила через browser API. Сам MJPEG может при этом открываться напрямую.');
    }
  };

  const takeSnapshot = () => {
    const a = document.createElement('a');
    a.href = `${baseUrl}/photoaf.jpg`;
    a.target = '_blank';
    a.rel = 'noreferrer';
    a.click();
    logEvent('Snapshot requested', 'Autofocus photo');
  };

  const toggleTorch = () => sendCommand(status.torch ? '/disabletorch' : '/enabletorch', status.torch ? 'Torch off' : 'Torch on');

  const toggleCamera = () => {
    const next = status.camera === 'front' ? 'off' : 'on';
    sendCommand(`/settings/ffc?set=${next}`, next === 'on' ? 'Front camera selected' : 'Back camera selected');
  };

  useEffect(() => {
    if (!connected) return;
    const timer = window.setInterval(refreshStatus, 5000);
    return () => window.clearInterval(timer);
  }, [connected, baseUrl]);

  useEffect(() => {
    if (!motionEnabled) return;
    const detector = window.setInterval(() => {
      // IP Webcam can expose its own motion-active sensor through sensors.json.
      // We poll it here when CORS allows browser access.
      fetch(`${baseUrl}/sensors.json?sense=motion_active`, { mode: 'cors', cache: 'no-store' })
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          const raw = data?.motion_active?.data?.[0]?.[1]?.[0];
          const value = Number(raw);
          if (Number.isFinite(value) && value > 0) {
            const stamp = new Date().toLocaleTimeString();
            setLastMotionAt(stamp);
            logEvent('Motion detected', `sensor=${value} · sensitivity ${motionSensitivity}%`);
          }
        })
        .catch(() => undefined);
    }, 1200);
    return () => window.clearInterval(detector);
  }, [motionEnabled, baseUrl, motionSensitivity]);

  return (
    <main className="page-shell">
      <header className="topbar">
        <div className="brand-wrap">
          <div className="brand-mark"><Camera size={18} strokeWidth={2.2} /></div>
          <div>
            <div className="brand">CAM CONTROL <span>CENTER</span></div>
            <div className="subbrand">LOCAL CAMERA MANAGEMENT</div>
          </div>
        </div>
        <div className="top-actions">
          <div className={`status-pill ${connected ? 'ok' : ''}`}>
            <span className="dot" /> {connected ? 'ONLINE' : 'OFFLINE'}
          </div>
          <button className="icon-button" type="button" onClick={refreshStatus} aria-label="Refresh status">
            <RefreshCw size={17} className={loading ? 'spin' : ''} />
          </button>
          <button className="icon-button" type="button" onClick={() => setShowSettings((v) => !v)} aria-label="Settings">
            <Settings2 size={17} />
          </button>
        </div>
      </header>

      <section className="toolbar-card">
        <div className="toolbar-title">
          <Signal size={16} />
          <span>Camera endpoint</span>
        </div>
        <div className="url-row">
          <input value={draftUrl} onChange={(e) => setDraftUrl(e.target.value)} placeholder="http://192.168.1.42:8080" aria-label="Camera URL" />
          <button className="primary-button" type="button" onClick={connect}>Connect</button>
        </div>
      </section>

      {error && (
        <div className="alert-bar">
          <AlertTriangle size={17} />
          <span>{error}</span>
          <button type="button" onClick={() => setError('')} aria-label="Dismiss"><X size={16} /></button>
        </div>
      )}

      <section className="dashboard-grid">
        <div className="main-column">
          <div className={`video-card ${fullscreen ? 'fullscreen-card' : ''}`}>
            <div className="video-head">
              <div className="camera-title">
                <span className="live-dot" />
                <div><strong>CAMERA 01</strong><small>{baseUrl}</small></div>
              </div>
              <div className="video-meta">
                <span>{status.width && status.height ? `${status.width}×${status.height}` : '—'}</span>
                <span>{status.fps ? `${status.fps} FPS` : 'MJPEG'}</span>
              </div>
            </div>
            <div className="video-stage">
              <img ref={imgRef} src={streamUrl} alt="Live IP Webcam stream" className="stream" onError={() => setConnected(false)} />
              {!connected && <div className="stream-overlay"><Wifi size={28} /><div><strong>Stream not confirmed</strong><span>Check the IP Webcam server and endpoint.</span></div></div>}
              {motionEnabled && lastMotionAt && <div className="motion-badge"><Activity size={14} /> MOTION {lastMotionAt}</div>}
              <div className="stream-corners c1"/><div className="stream-corners c2"/><div className="stream-corners c3"/><div className="stream-corners c4"/>
            </div>
            <div className="video-controls">
              <button type="button" onClick={takeSnapshot}><ImageIcon size={17} /> Snapshot</button>
              <button type="button" onClick={() => sendCommand('/focus', 'Autofocus requested')}><Crosshair size={17} /> Focus</button>
              <button type="button" onClick={() => setFullscreen((v) => !v)}><Maximize2 size={17} /> {fullscreen ? 'Exit' : 'Fullscreen'}</button>
              <button type="button" onClick={() => window.open(`${baseUrl}`, '_blank', 'noopener,noreferrer')}><ExternalLink size={16} /> Native UI</button>
            </div>
          </div>

          <div className="control-grid">
            <div className="panel">
              <div className="panel-head"><div><span className="eyebrow">HARDWARE</span><h3>Camera controls</h3></div><Aperture size={18} /></div>
              <div className="control-list">
                <button type="button" className="control-row" onClick={toggleTorch}>
                  <span className="control-icon"><Flashlight size={17} /></span><span><strong>Flash / torch</strong><small>LED illumination</small></span><span className={`switch ${status.torch ? 'on' : ''}`}><i /></span>
                </button>
                <button type="button" className="control-row" onClick={toggleCamera}>
                  <span className="control-icon"><Camera size={17} /></span><span><strong>Camera side</strong><small>{status.camera === 'front' ? 'Front camera' : 'Back camera'}</small></span><span className="ghost-chip">TOGGLE</span>
                </button>
                <button type="button" className="control-row" onClick={() => sendCommand('/settings/night_vision?set=on', 'Night vision enabled')}>
                  <span className="control-icon"><Moon size={17} /></span><span><strong>Night vision</strong><small>Ask device to enable mode</small></span><span className="ghost-chip">ON</span>
                </button>
                <button type="button" className="control-row" onClick={() => sendCommand('/settings/overlay?set=on', 'Overlay enabled')}>
                  <span className="control-icon"><Sparkles size={17} /></span><span><strong>Overlay</strong><small>Camera metadata overlay</small></span><span className="ghost-chip">ON</span>
                </button>
              </div>
            </div>

            <div className="panel motion-panel">
              <div className="panel-head"><div><span className="eyebrow">AUTOMATION</span><h3>Motion detection</h3></div><Activity size={18} /></div>
              <div className="motion-state">
                <div><span className={`pulse ${motionEnabled ? 'active' : ''}`} /><strong>{motionEnabled ? 'Monitoring active' : 'Monitoring paused'}</strong><small>{lastMotionAt ? `Last trigger ${lastMotionAt}` : 'Waiting for movement sensor'}</small></div>
                <label className="toggle"><input type="checkbox" checked={motionEnabled} onChange={(e) => setMotionEnabled(e.target.checked)} /><span /></label>
              </div>
              <div className="slider-wrap"><div className="slider-label"><span>Sensitivity</span><b>{motionSensitivity}%</b></div><input type="range" min="1" max="100" value={motionSensitivity} onChange={(e) => setMotionSensitivity(Number(e.target.value))} /></div>
              <div className="signal-note"><Shield size={15} /><span>Motion checks stay local in your browser when the camera API permits direct access.</span></div>
            </div>
          </div>
        </div>

        <aside className="side-column">
          <div className="panel telemetry">
            <div className="panel-head"><div><span className="eyebrow">TELEMETRY</span><h3>Camera status</h3></div><Gauge size={18} /></div>
            <div className="telemetry-grid">
              <Metric label="Connection" value={connected ? 'Stable' : 'Offline'} status={connected} />
              <Metric label="Battery" value={status.battery != null ? `${status.battery}%` : '—'} />
              <Metric label="Resolution" value={status.width ? `${status.width}×${status.height}` : '—'} />
              <Metric label="Audio" value={status.audio == null ? '—' : status.audio ? 'Enabled' : 'Disabled'} />
              <Metric label="Camera" value={status.camera ?? '—'} />
              <Metric label="Signal" value={'▮'.repeat(signal) + '▯'.repeat(4 - signal)} mono />
            </div>
          </div>

          <div className="panel event-panel">
            <div className="panel-head"><div><span className="eyebrow">ACTIVITY</span><h3>Event log</h3></div><button type="button" className="clear-button" onClick={() => setEvents([])}>Clear</button></div>
            <div className="event-list">
              {events.length === 0 ? <div className="empty-state"><Activity size={18} /><span>No events yet</span><small>Connection and motion events appear here.</small></div> : events.map((event) => <div className="event-item" key={event.id}><div className="event-line"><b>{event.title}</b><time>{event.time}</time></div><small>{event.detail}</small></div>)}
            </div>
          </div>
        </aside>
      </section>

      {showSettings && (
        <div className="settings-drawer">
          <div className="drawer-head"><div><span className="eyebrow">CONFIGURATION</span><h3>Dashboard settings</h3></div><button type="button" className="icon-button" onClick={() => setShowSettings(false)}><X size={17} /></button></div>
          <div className="drawer-row"><span>Stream path</span><code>/videofeed</code></div>
          <div className="drawer-row"><span>Status API</span><code>/status.json?show_avail=1</code></div>
          <div className="drawer-row"><span>Snapshot</span><code>/photoaf.jpg</code></div>
          <div className="drawer-row"><span>Motion sensor</span><code>/sensors.json?sense=motion_active</code></div>
          <div className="drawer-row"><span>Native flash</span><code>/enabletorch · /disabletorch</code></div>
          <div className="drawer-footer"><Sun size={15} /> Designed for local IP Webcam usage. Keep the camera endpoint on a trusted network.</div>
        </div>
      )}
    </main>
  );
}

function Metric({ label, value, status, mono }: { label: string; value: string; status?: boolean; mono?: boolean }) {
  return <div className="metric"><span>{label}</span><strong className={mono ? 'mono' : ''}>{status !== undefined && <i className={`metric-dot ${status ? 'good' : ''}`} />}{value}</strong></div>;
}
