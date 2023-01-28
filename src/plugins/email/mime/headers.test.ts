import assert from "node:assert";
import test from "node:test";
import { parseHeadersAndBody } from "./headers";

test("#parseHeadersAndBody", () => {
  const { headers, body } = parseHeadersAndBody(
    `
    
Subject: Email not found
Content-Type: multipart/related;
\tboundary="--==_mimepart_63d2f1f98fc2d_84611648809aa";
 charset=UTF-8
Content-Transfer-Encoding: 7bit

Hi!
`.replace(/\n/g, "\r\n")
  );

  assert.deepEqual(headers, [
    {
      name: "subject",
      value: "Email not found",
    },
    {
      name: "content-type",
      value:
        'multipart/related;boundary="--==_mimepart_63d2f1f98fc2d_84611648809aa";charset=UTF-8',
    },
    {
      name: "content-transfer-encoding",
      value: "7bit",
    },
  ]);
});
