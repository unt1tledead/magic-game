# Cam Control Center

A Next.js dashboard for a locally reachable Android IP Webcam server.

## Run

```bash
npm install
npm run dev
```

Open `http://localhost:3000` and enter the IP Webcam base URL, e.g. `http://192.168.1.42:8080`.

## Expected IP Webcam endpoints

- `/videofeed` – MJPEG video feed
- `/status.json?show_avail=1` – status / available settings
- `/photoaf.jpg` – autofocus snapshot
- `/enabletorch` and `/disabletorch` – torch control
- `/focus` – autofocus request
- `/settings/ffc?set=on|off` – front/back camera toggle
- `/settings/night_vision?set=on|off` – night vision
- `/settings/overlay?set=on|off` – overlay
- `/sensors.json?sense=motion_active` – motion sensor polling

Some IP Webcam configurations may block browser cross-origin requests. The video `<img>` may still render while JavaScript `fetch()` calls fail. For a public Vercel deployment, the phone's private LAN address must be reachable from the browser's network, and remote control should only be used on a trusted network.
