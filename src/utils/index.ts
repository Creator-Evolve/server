export const extractExtension = (url: string) => {
  if (!url) return;

  const match = url.match(/\.(\w+)(?:\?.*)?$/);
  return match ? match[1] : null;
};

export const dataURItoBuffer = (dataURI: string): Buffer => {
  // Split the data URI into the metadata and the base64 data
  const [metadata, base64Data] = dataURI.split(',');

  // Decode the base64 data into a binary string
  const binaryData = Buffer.from(base64Data, 'base64');

  return binaryData;
};
