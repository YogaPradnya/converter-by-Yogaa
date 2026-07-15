"use client";

import React from "react";

export default function AdBanner({ id, width, height }) {
  if (!id) return null;

  const srcDoc = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <style>
          body {
            margin: 0;
            padding: 0;
            display: flex;
            justify-content: center;
            align-items: center;
            height: 100vh;
            background-color: transparent;
            overflow: hidden;
          }
        </style>
      </head>
      <body>
        <script type="text/javascript">
          atOptions = {
            'key' : '${id}',
            'format' : 'iframe',
            'height' : ${height},
            'width' : ${width},
            'params' : {}
          };
        </script>
        <script type="text/javascript" src="https://scarleterror.com/${id}/invoke.js"></script>
      </body>
    </html>
  `;

  return (
    <div
      className="ad-banner-container"
      style={{
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        width: "100%",
        margin: "16px 0",
        overflow: "hidden",
      }}
    >
      <iframe
        title={`Ad-${id}`}
        srcDoc={srcDoc}
        width={width}
        height={height}
        style={{
          border: "none",
          overflow: "hidden",
          backgroundColor: "transparent",
        }}
        scrolling="no"
        loading="lazy"
      />
    </div>
  );
}
