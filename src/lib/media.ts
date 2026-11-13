import type PocketBase from "pocketbase";
import type { MediaKind, QuestionRecord } from "./pbTypes";

const AUDIO_EXT = /\.(mp3|wav|ogg|m4a|aac|flac)(?:$|[?#])/i;
const VIDEO_EXT = /\.(mp4|webm|mov|m4v|ogv)(?:$|[?#])/i;

export function inferMediaKind(urlOrFilename: string, explicit?: MediaKind | "" | null): MediaKind {
  if (explicit === "image" || explicit === "audio" || explicit === "video") {
    return explicit;
  }
  if (AUDIO_EXT.test(urlOrFilename) || urlOrFilename.startsWith("data:audio/")) {
    return "audio";
  }
  if (VIDEO_EXT.test(urlOrFilename) || urlOrFilename.startsWith("data:video/")) {
    return "video";
  }
  return "image";
}

export function resolveQuestionMedia(
  pb: PocketBase | null | undefined,
  q: {
    id: string;
    collectionId?: string;
    collectionName?: string;
    media?: string;
    mediaUrl?: string;
    mediaType?: QuestionRecord["mediaType"];
  }
): { mediaUrl: string; mediaType: MediaKind } | null {
  if (q.media && pb) {
    const url = pb.files.getURL(q, q.media);
    return {
      mediaUrl: url,
      mediaType: inferMediaKind(q.media, q.mediaType),
    };
  }
  const external = q.mediaUrl?.trim();
  if (external) {
    return {
      mediaUrl: external,
      mediaType: inferMediaKind(external, q.mediaType),
    };
  }
  return null;
}
