import * as dotenv from "dotenv";
dotenv.config();

import fs from "fs";
import fetch from "node-fetch";
import { FetchHandlerResponse } from "@atproto/xrpc";

import pkg from "@atproto/api";
const { BskyAgent, RichText, jsonToLex, stringifyLex } = pkg;

const GET_TIMEOUT = 15e3; // 15s
const POST_TIMEOUT = 60e3; // 60s

const fetchHandler = async (
  reqUri: string,
  reqMethod: string,
  reqHeaders: Record<string, string>,
  reqBody: any
): Promise<FetchHandlerResponse> => {
  const controller = new AbortController();
  const to = setTimeout(
    () => controller.abort(),
    reqMethod === "post" ? POST_TIMEOUT : GET_TIMEOUT
  );

  const body = typeof reqBody === "object" ? stringifyLex(reqBody) : reqBody;

  const res = await fetch(reqUri, {
    method: reqMethod,
    headers: reqHeaders,
    body,
    signal: controller.signal,
  });

  const resStatus = res.status;
  const resHeaders: Record<string, string> = {};
  res.headers.forEach((value: string, key: string) => {
    resHeaders[key] = value;
  });
  const resMimeType = resHeaders["Content-Type"] || resHeaders["content-type"];
  let resBody;
  if (resMimeType) {
    if (resMimeType.startsWith("application/json")) {
      resBody = jsonToLex(await res.json());
    } else if (resMimeType.startsWith("text/")) {
      resBody = await res.text();
    } else {
      throw new Error("TODO: non-textual response body");
    }
  }

  clearTimeout(to);

  console.log("REQ", reqUri, reqMethod, reqHeaders, reqBody);
  console.log("RES", resStatus, resHeaders, resMimeType, resBody);
  return {
    status: resStatus,
    headers: resHeaders,
    body: resBody,
  };
};

BskyAgent.configure({
  fetch: fetchHandler,
});

const {
  BLUESKY_SERVER: service,
  BLUESKY_USERNAME: identifier,
  BLUESKY_PASSWORD: password,
} = process.env;

const agent = new BskyAgent({ service });

await agent.login({ identifier, password });

const testImagePost = async (
  text: string,
  imageUrl: string,
  imageAlt: string
) => {
  const rt = new RichText({ text });
  await rt.detectFacets(agent);

  const data = fs.readFileSync(imageUrl);

  const resp = await agent.uploadBlob(data, {
    encoding: "image/jpeg",
  });

  if (!resp.success) {
    const msg = `Unable to upload image ${imageUrl}`;
    console.error(msg, resp);
    throw new Error(msg);
  }

  const {
    data: { blob: image },
  } = resp;

  return agent.post({
    text: rt.text,
    facets: rt.facets,
    embed: {
      $type: "app.bsky.embed.images",
      images: [
        {
          image,
          alt: imageAlt,
        },
      ],
    },
  });
};

await testImagePost(
  "Test photo by @robpc.com, posted using this example code https://github.com/robpc/bluesky-photo-test",
  "./images/robpc_tidal_basin.jpg",
  "Photo looking over the Tidal Basin in Washington, DC. The cherry blossoms are in bloom and the Washington Monument is in the background."
);
