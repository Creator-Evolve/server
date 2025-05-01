import * as ytdl from '@distube/ytdl-core';
import { HttpProxyAgent } from 'http-proxy-agent';
import { HttpsProxyAgent } from 'https-proxy-agent';

// Proxy list for rotating requests
const PROXY_LIST = [
  '152.26.229.42:9443',
  '152.26.229.66:9443',
  '152.26.229.88:9443',
  '152.26.231.42:9443',
  '152.26.231.77:9443',
  '152.26.231.86:9443',
  '177.234.241.25:999',
  '177.234.241.26:999',
  '177.234.241.27:999',
  '177.234.241.30:999',
];

let currentProxyIndex = 0;

// Get the next proxy in the rotation
function getNextProxy(): string {
  const proxy = PROXY_LIST[currentProxyIndex];
  currentProxyIndex = (currentProxyIndex + 1) % PROXY_LIST.length;
  return proxy;
}

/**
 * Get YouTube video info with enhanced CAPTCHA bypassing
 * This uses multiple techniques to avoid the "Sign in to confirm you're not a bot" challenge
 */
export async function getYouTubeVideoInfo(videoUrl: string): Promise<ytdl.videoInfo> {
  // Set environment variables for proxy
  const proxy = getNextProxy();
  const proxyUrl = `http://${proxy}`;
  
  // Save original environment variables
  const originalHttpProxy = process.env.HTTP_PROXY;
  const originalHttpsProxy = process.env.HTTPS_PROXY;
  
  // Set proxy environment variables
  process.env.HTTP_PROXY = proxyUrl;
  process.env.HTTPS_PROXY = proxyUrl;
  
  try {
    // Configure options to look more like a browser
    const options: ytdl.getInfoOptions = {
      // Use WEB player client to avoid some parsing issues
      playerClients: ['WEB'],
      
      requestOptions: {
        headers: {
          // Use a realistic browser user-agent
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.0.0 Safari/537.36',
          // Add referer to look more legitimate
          'Referer': 'https://www.youtube.com/',
          // Add other headers to appear more like a browser
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
          'Connection': 'keep-alive',
          'Upgrade-Insecure-Requests': '1',
          'Sec-Fetch-Dest': 'document',
          'Sec-Fetch-Mode': 'navigate',
          'Sec-Fetch-Site': 'none',
          'Sec-Fetch-User': '?1',
          'Pragma': 'no-cache',
          'Cache-Control': 'no-cache',
        },
      },
    };
    
    // Get the video info
    const videoInfo = await ytdl.getInfo(videoUrl, options);
    return videoInfo;
  } finally {
    // Restore original environment variables
    if (originalHttpProxy) {
      process.env.HTTP_PROXY = originalHttpProxy;
    } else {
      delete process.env.HTTP_PROXY;
    }
    
    if (originalHttpsProxy) {
      process.env.HTTPS_PROXY = originalHttpsProxy;
    } else {
      delete process.env.HTTPS_PROXY;
    }
  }
}

/**
 * Download a YouTube video stream with CAPTCHA bypassing
 */
export function getYouTubeVideoStream(videoUrl: string, options: ytdl.downloadOptions = {}): NodeJS.ReadableStream {
  // Set environment variables for proxy
  const proxy = getNextProxy();
  const proxyUrl = `http://${proxy}`;
  
  // Set proxy environment variables
  process.env.HTTP_PROXY = proxyUrl;
  process.env.HTTPS_PROXY = proxyUrl;
  
  // Configure options to look more like a browser
  const downloadOptions: ytdl.downloadOptions = {
    ...options,
    // Default to highest quality if not specified
    quality: options.quality || 'highest',
    
    requestOptions: {
      headers: {
        // Use a realistic browser user-agent
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.0.0 Safari/537.36',
        // Add referer to look more legitimate
        'Referer': 'https://www.youtube.com/',
        // Add other headers to appear more like a browser
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Connection': 'keep-alive',
        ...(options.requestOptions?.headers || {}),
      },
    },
  };
  
  // Create the stream
  const stream = ytdl(videoUrl, downloadOptions);
  
  // Clean up environment variables when the stream ends or errors
  stream.on('end', () => {
    delete process.env.HTTP_PROXY;
    delete process.env.HTTPS_PROXY;
  });
  
  stream.on('error', () => {
    delete process.env.HTTP_PROXY;
    delete process.env.HTTPS_PROXY;
  });
  
  return stream;
} 