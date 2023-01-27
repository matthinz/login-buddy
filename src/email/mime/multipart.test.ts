import assert from "node:assert";
import test from "node:test";
import { createMultipartParser } from "./multipart";

test("parse multipart/related", () => {
  const parser = createMultipartParser("foo");
  const [chunks, remainder] = parser(
    `

--foo
Content-Type: text/plain; encoding=utf-8

hello!

--foo
Content-Type: text/html

<b>there!</b>

--foo--

and here is some trailing text
`.replace(/\n/g, "\r\n")
  );

  assert.deepEqual(chunks, [
    {
      contentType: {
        name: "text/plain",
        options: {
          encoding: "utf-8",
        },
      },
      headers: [],
      body: "hello!\r\n",
    },
    {
      contentType: {
        name: "text/html",
        options: {},
      },
      headers: [],
      body: "<b>there!</b>\r\n",
    },
  ]);

  assert.equal(remainder, "\r\nand here is some trailing text\r\n");
});
