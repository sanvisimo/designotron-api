export enum ExportType {
  Png,
  Video,
}

export class Video {
  type: ExportType;
  json?: string;
  html?: string;
  frameNumber?: number;
}
