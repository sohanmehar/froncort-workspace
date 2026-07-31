# Known Limitations & Next Improvements

## Current Limitations
- **In-Memory Cron Job:** AI digest updates currently Node process me Scheduled cron ke zariye run ho rahe hain. Production level scaling ke liye BullMQ/Redis queue lagana better rahega.
- **Attachments:** Files information text metadata format me store ho rahi hai, real S3 storage bucket setup production pipeline me add hoga.

## Future Scope
- Real-time WebSocket updates for live ticket comment threads.
- GitHub Webhooks integration to sync pull request state changes dynamically.