export type ContentType = {
  name: string;
  options: Record<string, string>;
};

export type Header = {
  name: string;
  value: string;
};

export type MIMEChunk = {
  contentType: ContentType;
  headers: Header[];
  body: string | Buffer;
};
