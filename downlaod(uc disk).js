
(async () => {
  const api = "https://pc-api.uc.cn/1/clouddrive";

  // Recover the share token from the page's existing API request.
  const detailUrl = performance.getEntriesByType("resource")
    .map(x => x.name)
    .find(u => u.includes("/1/clouddrive/transfer_share/detail")
      && u.includes("stoken="));

  if (!detailUrl) {
    console.error("Share token not found. Reload the share page first.");
    return;
  }

  const stoken = new URL(detailUrl).searchParams.get("stoken");

  // Read the public share metadata.
  const detailResponse = await fetch(detailUrl, {
    credentials: "include"
  });
  const detail = await detailResponse.json();

  if (detail.code !== 0 || !detail.data?.list?.length) {
    console.error("Could not retrieve shared file metadata:", detail);
    return;
  }

  const file = detail.data.list[0];
  const pwd_id = detail.data.share.pwd_id;

  console.log("Requesting download link for:", file.file_name);

  // Request the download URL from UC's documented-by-community API.
  const response = await fetch(
    `${api}/file/download?entry=ft&fr=pc&pr=UCBrowser`,
    {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json;charset=UTF-8",
        "Accept": "application/json, text/plain, */*"
      },
      body: JSON.stringify({
        fids: [file.fid],
        pwd_id,
        stoken,
        fids_token: [file.share_fid_token]
      })
    }
  );

  const result = await response.json();
  console.log("UC download API response:", result);

  const item = result.data?.[0];
  const downloadUrl = item?.download_url || item?.url;

  if (result.code === 0 && downloadUrl) {
    console.log("DIRECT DOWNLOAD URL:", downloadUrl);

    const a = document.createElement("a");
    a.href = downloadUrl;
    a.target = "_blank";
    a.rel = "noopener";
    a.textContent = "Open direct download";
    a.style.cssText =
      "position:fixed;top:10px;left:10px;z-index:999999;" +
      "background:white;color:black;padding:15px;border:2px solid";
    document.body.appendChild(a);
    console.log("A download link has been added to the page.");
  } else {
    console.warn(
      "No direct URL returned. Inspect the API response above.",
      result
    );
  }
})();
