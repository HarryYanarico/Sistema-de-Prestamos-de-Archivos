const STORAGE_KEY = 'server_lan_ip';

export function getStoredServerIp(): string | null {
  return localStorage.getItem(STORAGE_KEY);
}

export function setStoredServerIp(ip: string) {
  localStorage.setItem(STORAGE_KEY, ip);
}

export async function detectLocalIp(): Promise<string> {
  try {
    const res = await fetch('/api/server-ip/');
    const json = await res.json();
    if (json.ip && json.ip !== '127.0.0.1') {
      setStoredServerIp(json.ip);
      return json.ip;
    }
  } catch {
    // backend not reachable
  }
  return '';
}

export async function getQrBaseUrl(): Promise<string> {
  const envUrl = import.meta.env.VITE_QR_BASE_URL as string | undefined;
  if (envUrl) {
    const clean = envUrl.replace(/\/+$/, '');
    return clean;
  }

  const { hostname, port, protocol } = window.location;

  if (hostname !== 'localhost' && hostname !== '127.0.0.1') {
    return `${protocol}//${hostname}${port ? ':' + port : ''}`;
  }

  const detected = await detectLocalIp();
  if (detected) {
    return `${protocol}//${detected}${port ? ':' + port : ''}`;
  }

  return `${protocol}//${hostname}${port ? ':' + port : ''}`;
}
