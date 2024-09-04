export enum IMAGE_GENERATION_MODEL {
  DALLE = 'dall-e',
  STABLE_DIFFUSION = 'stable-diffusion',
  STABLE_DIFFUSION_D3 = 'stable-diffusion-d3',
}

export enum IMAGE_OUTPUT_FORMAT {
  WEBP = 'webp',
  PNG = 'png',
  JPEG = 'jpeg',
}

export enum IMAGE_SIZE {
  SIZE_256x256 = '256x256',
  SIZE_512x512 = '512x512',
  SIZE_1024x1024 = '1024x1024',
  SIZE_1792x1024 = '1792x1024',
  SIZE_1024x1792 = '1024x1792',
}

export enum IMAGE_EDIT_PARAM{
  SIZE_256x256 = '256x256',
  SIZE_512x512 = '512x512',
  SIZE_1024x1024 = '1024x1024',
}

export enum IMAGE_ASPECT_RATIO {
  WIDESCREEN = '16:9',
  SQUARE = '1:1',
  ULTRAWIDE = '21:9',
  PORTRAIT = '2:3',
  LANDSCAPE = '3:2',
  FOUR_BY_FIVE = '4:5',
  FIVE_BY_FOUR = '5:4',
  VERTICAL = '9:16',
  VERTICAL_ULTRAWIDE = '9:21',
}

export enum IMAGE_QUALITY {
  HD = 'hd',
  STANDARD = 'standard',
}

export enum IMAGE_STYLE {
  VIVID = 'vivid',
  NATURAL = 'natural',
}

export enum IMAGE_TYPE {
  TEXT_TO_IMAGE = 'text-to-image',
  IMAGE_TO_IMAGE = 'image-to-image',
}
