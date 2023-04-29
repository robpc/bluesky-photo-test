import * as dotenv from "dotenv";
dotenv.config();

import fs from "fs";

import pkg from "@atproto/api";
const { BskyAgent, RichText, jsonToLex, stringifyLex } = pkg;

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
  "Photo posting example by @robpc.com https://github.com/robpc/bluesky-photo-test image by Cassidy James Blaede https://unsplash.com/photos/TA22tc6YyMw",
  "./images/cassidy-james-blaede-TA22tc6YyMw-unsplash.jpg",
  "Close up portrait of a cat. The cat in profile staring to the left of the photo."
);
