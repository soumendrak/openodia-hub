/**
 * YouTube channels shown on the Tutorials page.
 *
 * To add a new channel:
 * 1. Find the channel's handle (e.g. @tfugbbsr) and channel ID.
 *    - Channel ID: visit the channel page → view source → search "channelId"
 *      or use https://commentpicker.com/youtube-channel-id.php
 * 2. Append an entry below.
 */
export type Channel = {
  handle: string;
  name: string;
  url: string;
  channelId?: string;
};

export const CHANNELS: Channel[] = [
  {
    handle: "OdiaGenAI",
    name: "OdiaGenAI",
    url: "https://www.youtube.com/@OdiaGenAI",
    channelId: "UCZsktbZ-Tu2QdFhTBYFQcsg",
  },
  {
    handle: "openodia",
    name: "OpenOdia",
    url: "https://www.youtube.com/@openodia",
    channelId: "UCMiaqPIaXo19LuQx0zbEFAA",
  },
  {
    handle: "OdiasInML",
    name: "Odias in ML",
    url: "https://www.youtube.com/@OdiasInML",
    channelId: "UCaoGfM_49C8kcKqyTh-fr6Q",
  },
  {
    handle: "tfugbbsr",
    name: "TFUG Bhubaneswar",
    url: "https://www.youtube.com/@tfugbbsr",
    channelId: "UCKANPIRK8mbEvxDisa8x-wQ",
  },
];
