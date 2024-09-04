import { ConfigService } from '@/common/config/services/config.service';
import { HttpService } from '@/common/http/services/http.service';
import { LoggerService } from '@/common/logger/services/logger.service';
import { Injectable } from '@nestjs/common';

import { lastValueFrom } from 'rxjs';

import { languageCodes } from '@/common/constants/audio.enum';
import * as FormData from 'form-data';
import { MODEL_ID } from '../enum';
import { AxiosRequestConfig } from 'axios';
import { createReadStream } from 'fs';
import { v4 as uuid } from 'uuid';
import { extractExtension } from 'utils';

interface ElevenLabDubRequest {
  url: string;
  target_lang: string;
  highest_resolution: boolean;
  num_speakers: number;
  start_time: number;
  end_time: number;
  source_lang: string;
}

export enum SPEECH_TO_SPEECH_MODEL {
  Eleven_Multilingual_sts_v2 = 'eleven_multilingual_sts_v2',
  Eleven_English_sts_v2 = 'eleven_english_sts_v2',
}

export interface ElevenLabsDubResponse {
  dubbing_id: string;
  expected_duration: string;
}

export interface ElevenLabsTextToSpeechRequest {
  voice_id: string;
  text: string;
  stability?: number;
  similarity_boost?: number;
  style?: number;
  use_speaker_boost?: boolean;
}

export enum ELEVEN_LABS_SPEECH_TO_SPEECH_OUTPUT_FORMAT {
  /**
   * mp3 format with a 22.05kHz sample rate at 32kbps.
   * Suitable for low-quality audio output.
   */
  MP3_22050_32 = 'mp3_22050_32',

  /**
   * mp3 format with a 44.1kHz sample rate at 32kbps.
   * Low-quality audio output with a higher sample rate.
   */
  MP3_44100_32 = 'mp3_44100_32',

  /**
   * mp3 format with a 44.1kHz sample rate at 64kbps.
   * Moderate quality audio output.
   */
  MP3_44100_64 = 'mp3_44100_64',

  /**
   * mp3 format with a 44.1kHz sample rate at 96kbps.
   * Higher quality audio output.
   */
  MP3_44100_96 = 'mp3_44100_96',

  /**
   * mp3 format with a 44.1kHz sample rate at 128kbps.
   * Default output format providing good quality audio.
   */
  MP3_44100_128 = 'mp3_44100_128',

  /**
   * mp3 format with a 44.1kHz sample rate at 192kbps.
   * High-quality audio output. Requires subscription to Creator tier or above.
   */
  MP3_44100_192 = 'mp3_44100_192',

  /**
   * PCM format (S16LE) with a 16kHz sample rate.
   * Suitable for raw audio data processing.
   */
  PCM_16000 = 'pcm_16000',

  /**
   * PCM format (S16LE) with a 22.05kHz sample rate.
   * Higher sample rate for raw audio data.
   */
  PCM_22050 = 'pcm_22050',

  /**
   * PCM format (S16LE) with a 24kHz sample rate.
   * Provides a good balance between quality and file size.
   */
  PCM_24000 = 'pcm_24000',

  /**
   * PCM format (S16LE) with a 44.1kHz sample rate.
   * High-quality raw audio data. Requires subscription to Pro tier or above.
   */
  PCM_44100 = 'pcm_44100',

  /**
   * μ-law (u-law) format with an 8kHz sample rate.
   * Commonly used in telephony applications like Twilio audio inputs.
   */
  ULAW_8000 = 'ulaw_8000',
}

export interface ElevenLabsSpeechToSpeechRequest {
  voice_id: string;
  output_format: ELEVEN_LABS_SPEECH_TO_SPEECH_OUTPUT_FORMAT;
  audio_path: string;
}

export interface InstantVoiceCloneRequest {
  name: string;
  files: string[];
  description: string;
  labels: { [key: string]: string };
}

export interface GenerateRandomVoiceRequest {
  gender: string;
  age: string;
  accent: string;
  accent_strength: number;
  text: string;
}

export interface SaveRandomGeneratedVoiceRequest {
  generated_voice_id: string;
  labels: { [key: string]: string };
  voice_description: string;
  voice_name: string;
}

@Injectable()
export class ElevenLabsService {
  private readonly apiUrl: string;
  private readonly apiKey: string;
  constructor(
    private configService: ConfigService,
    private loggerService: LoggerService,
    private httpService: HttpService,
  ) {
    this.apiUrl = this.configService.get('ELEVEN_LABS_BASE_URL');
    this.apiKey = this.configService.get('ELEVEN_LABS_API_KEY');
  }

  async getVoicesList() {
    this.loggerService.log(`getVoicesList: Fetching all voices from the EL`);
    try {
      const voicesResp = await lastValueFrom(
        this.httpService.get(`${this.apiUrl}/voices`, {
          headers: {
            'xi-api-key': this.apiKey,
          },
        }),
      ).then((res) => res.data);

      const transformedList = voicesResp.voices.map((voice) => ({
        id: voice.voice_id,
        name: voice.name,
        preview: voice.preview_url,
        labels: voice.labels,
      }));

      this.loggerService.log(
        JSON.stringify({
          message: `getVoicesList: Fetched all voices from the EL`,
          data: transformedList,
        }),
      );

      return transformedList;
    } catch (error: any) {
      this.loggerService.log(
        JSON.stringify({
          message: `getVoicesList: Error occured`,
          data: error,
        }),
      );
      throw new Error(error.message);
    }
  }

  async getSharedVoicesList() {
    this.loggerService.log(
      `getSharedVoicesList: Fetching all voices from the EL`,
    );
    try {
      const sharedVoicesResp = await lastValueFrom(
        this.httpService.get(`${this.apiUrl}/shared-voices`, {
          headers: {
            'xi-api-key': this.apiKey,
          },
        }),
      ).then((res) => res.data);

      const transformedSharedVoicesList = sharedVoicesResp.voices.map(
        (voice) => ({
          id: voice.voice_id,
          name: voice.name,
          preview: voice.preview_url,
          rate: voice.rate,
          public_owner_id: voice.public_owner_id,
        }),
      );

      this.loggerService.log(
        JSON.stringify({
          message: `getSharedVoicesList: Fetched all voices from the EL`,
          data: transformedSharedVoicesList,
        }),
      );

      return transformedSharedVoicesList;
    } catch (error: any) {
      this.loggerService.log(
        JSON.stringify({
          message: `getSharedVoicesList: Error occured`,
          data: error,
        }),
      );
      throw new Error(error.message);
    }
  }

  async addSharedVoiceInLibrary(
    public_owner_id: string,
    voice_id: string,
    name: string,
  ) {
    this.loggerService.log(
      `addSharedVoiceInLibrary: Adding voice ${voice_id} to the library for owner ${public_owner_id} with ${name}`,
    );
    try {
      const resp = await lastValueFrom(
        this.httpService.post(
          `${this.apiUrl}/voices/add/${public_owner_id}/${voice_id}`,
          { new_name: name },
          {
            headers: {
              'xi-api-key': this.apiKey,
            },
          },
        ),
      ).then((res) => res.data);

      this.loggerService.log(
        JSON.stringify({
          message: `addSharedVoiceInLibrary: Successfully added voice ${voice_id} for owner ${public_owner_id}`,
          data: resp,
        }),
      );

      return resp;
    } catch (error: any) {
      this.loggerService.log(
        JSON.stringify({
          message: `addSharedVoiceInLibrary: Error occurred`,
          data: error,
        }),
      );
      throw new Error(error.message);
    }
  }

  async dubbing({
    url,
    target_lang,
    source_lang = 'auto',
    end_time,
    start_time,
    highest_resolution = true,
    num_speakers = 0,
  }: ElevenLabDubRequest): Promise<ElevenLabsDubResponse> {
    if (!languageCodes.includes(target_lang))
      throw new Error('Invalid Language Code');

    try {
      const formData = new FormData();
      formData.append('source_url', url);
      formData.append('target_lang', target_lang);
      formData.append('mode', 'automatic');
      formData.append(
        'highest_resolution',
        highest_resolution ? 'true' : 'false',
      );
      formData.append('num_speakers', num_speakers.toString());
      formData.append('source_lang', source_lang);
      if (start_time) formData.append('start_time', start_time);
      if (end_time) formData.append('end_time', end_time);

      const resp = await lastValueFrom(
        this.httpService.post(`${this.apiUrl}/dubbing`, formData, {
          headers: {
            'xi-api-key': this.apiKey,
            ...formData.getHeaders(),
          },
        }),
      ).then((res) => res.data);

      return resp;
    } catch (error: any) {
      this.loggerService.log(
        JSON.stringify({
          message: `dubbing: Error occured`,
          data: error,
        }),
      );
      throw new Error(error.message);
    }
  }

  async getDubStatus(dubbing_id: string) {
    try {
      const resp = await lastValueFrom(
        this.httpService.get(`${this.apiUrl}/dubbing/${dubbing_id}`, {
          headers: {
            'xi-api-key': this.apiKey,
          },
        }),
      ).then((res) => res.data);
      return resp;
    } catch (error: any) {
      this.loggerService.log(
        JSON.stringify({
          message: `getVoicesList: Error occured`,
          data: error,
        }),
      );
      throw new Error(error.message);
    }
  }

  async downloadDubbedFile(dubbing_id: string, language: string) {
    try {
      const resp = await lastValueFrom(
        this.httpService.get(
          `${this.apiUrl}/dubbing/${dubbing_id}/audio/${language}`,
          {
            headers: {
              'xi-api-key': this.apiKey,
            },
            responseType: 'stream',
          },
        ),
      ).then((res) => res.data);

      return resp;
    } catch (error: any) {
      this.loggerService.log(
        JSON.stringify({
          message: `downloadDubbedFile: Error occured`,
          data: error,
        }),
      );
      throw new Error(error.message);
    }
  }

  async removeDubbedFile(dubbing_id: string) {
    try {
      await lastValueFrom(
        this.httpService.delete(`${this.apiUrl}/dubbing/${dubbing_id}`, {
          headers: {
            'xi-api-key': this.apiKey,
          },
        }),
      );
    } catch (error: any) {
      this.loggerService.log(
        JSON.stringify({
          message: `removeDubbedFile: Error occured`,
          data: error,
        }),
      );
      throw new Error(error.message);
    }
  }

  async createTextToSpeech(body: ElevenLabsTextToSpeechRequest) {
    const {
      text,
      voice_id,
      stability,
      similarity_boost,
      style,
      use_speaker_boost,
    } = body;

    this.loggerService.log(
      'createTextToSpeech: Starting with provided body',
      JSON.stringify(body),
    );

    try {
      const resp = await lastValueFrom(
        this.httpService.post(
          `${this.apiUrl}/text-to-speech/${voice_id}`,
          {
            text,
            model_id: MODEL_ID,
            voice_settings: {
              stability: stability ?? 0.5,
              similarity_boost: similarity_boost ?? 0.75,
              style,
              use_speaker_boost,
            },
          },
          {
            headers: {
              'xi-api-key': this.apiKey,
            },
            responseType: 'stream',
          },
        ),
      ).then((res) => res.data);

      this.loggerService.log(
        'createTextToSpeech: Successfully created text to speech response',
      );

      return resp;
    } catch (error: any) {
      this.loggerService.error(
        JSON.stringify({
          message: 'createTextToSpeech: Error occurred',
          error: error.message,
          response: error.response?.data,
        }),
      );
      throw new Error(error.message);
    }
  }

  async createSpeechToSpeech(body: ElevenLabsSpeechToSpeechRequest) {
    const {
      audio_path,
      voice_id,
      output_format = ELEVEN_LABS_SPEECH_TO_SPEECH_OUTPUT_FORMAT.MP3_44100_192,
    } = body;

    this.loggerService.log(
      JSON.stringify({
        message: 'createSpeechToSpeech: Starting with provided body',
        body,
      }),
    );

    try {
      const formData = new FormData();
      const fileExtention = extractExtension(audio_path);
      formData.append('audio', createReadStream(audio_path), {
        filename: `${uuid()}.${fileExtention}`,
        contentType: `audio/${fileExtention}`,
      });
      formData.append(
        'model_id',
        SPEECH_TO_SPEECH_MODEL.Eleven_Multilingual_sts_v2,
      );

      this.loggerService.log(
        JSON.stringify({
          message: 'createSpeechToSpeech: FormData Completed',
          formData,
        }),
      );

      const resp = await lastValueFrom(
        this.httpService.post(
          `${this.apiUrl}/speech-to-speech/${voice_id}/stream`,
          formData,
          {
            headers: {
              'xi-api-key': this.apiKey,
              ...formData.getHeaders(),
            },
          },
        ),
      ).then((res) => res.data);

      this.loggerService.log(
        'createSpeechToSpeech: Successfully created speech to speech response',
      );

      return resp;
    } catch (error: any) {
      this.loggerService.error(
        JSON.stringify({
          message: 'createSpeechToSpeech: Error occurred',
          error: error.message,
          response: error.response?.data,
        }),
      );
      throw new Error(error.message);
    }
  }

  async instantVoiceClone(body: InstantVoiceCloneRequest) {
    this.loggerService.log(
      'instantVoiceClone: Starting Voice cloning with provided body',
      JSON.stringify(body),
    );

    const form = new FormData();
    form.append('name', body.name);
    form.append('description', body.description);
    body.files.forEach((filePath) => {
      form.append('files', createReadStream(filePath));
    });

    form.append('labels', JSON.stringify(body.labels));

    const headers = {
      ...form.getHeaders(),
      'xi-api-key': this.apiKey,
    };

    const config: AxiosRequestConfig = {
      headers: headers,
    };

    try {
      const resp = await lastValueFrom(
        this.httpService.post(`${this.apiUrl}/voices/add`, form, config),
      ).then((res) => res.data);

      this.loggerService.log(
        `instantVoiceClone: Successfully completed voice cloning, voice id: ${resp?.voice_id}`,
      );

      return resp;
    } catch (error: any) {
      this.loggerService.error(
        JSON.stringify({
          message: 'instantVoiceClone: Error occurred',
          error: error.message,
          response: error.response?.data,
        }),
      );
      throw new Error(error.message);
    }
  }

  async getRandomVoiceGenerationParam() {
    const headers = {
      'xi-api-key': this.apiKey,
    };

    const config = {
      headers: headers,
    };

    try {
      this.loggerService.log(
        JSON.stringify({
          message: 'Starting request to fetch voice generation parameters',
        }),
      );

      const resp = await lastValueFrom(
        this.httpService.get(
          `${this.apiUrl}/voice-generation/generate-voice/parameters`,
          config,
        ),
      ).then((res) => res.data);

      this.loggerService.log(
        JSON.stringify({
          message: 'Response received',
          data: resp,
        }),
      );

      return resp;
    } catch (error: any) {
      this.loggerService.error(
        JSON.stringify({
          message: 'getRandomVoiceGenerationParam: Error occurred',
          error: error.message,
          response: error.response?.data,
        }),
      );

      throw new Error(error.message);
    }
  }

  async generateRandomVoice(body: GenerateRandomVoiceRequest) {
    try {
      this.loggerService.log('generateRandomVoice: Start of function');
      let voiceId: string;

      this.loggerService.log(
        `generateRandomVoice: Sending request to generate voice with body: ${JSON.stringify(body)}`,
      );
      const resp = await lastValueFrom(
        this.httpService.post(
          `${this.apiUrl}/voice-generation/generate-voice`,
          {
            gender: body.gender,
            accent: body.accent,
            accent_strength: body.accent_strength,
            age: body.age,
            text: body.text,
          },
          {
            headers: {
              'xi-api-key': this.apiKey,
            },
            responseType: 'stream',
          },
        ),
      ).then((res) => {
        voiceId = res.headers['generated_voice_id'];
        this.loggerService.log(
          JSON.stringify({
            message: 'generateRandomVoice: Voice generation successful',
            generatedVoiceId: voiceId,
          }),
        );

        this.loggerService.log(
          'generateRandomVoice: Voice generation response received',
        );
        return res.data;
      });

      this.loggerService.log('generateRandomVoice: End of function');
      return { id: voiceId, data: resp };
    } catch (error: any) {
      throw new Error(error);
    }
  }

  async saveRandomGeneratedVoice(body: SaveRandomGeneratedVoiceRequest) {
    this.loggerService.log(
      JSON.stringify({
        message: 'saveRandomGeneratedVoice: Start of function',
      }),
    );

    try {
      this.loggerService.log(
        JSON.stringify({
          message: 'saveRandomGeneratedVoice: Sending request to create voice',
          data: body,
        }),
      );

      const resp = await lastValueFrom(
        this.httpService.post(
          `${this.apiUrl}/voice-generation/create-voice`,
          body,
          {
            headers: {
              'xi-api-key': this.apiKey,
            },
          },
        ),
      ).then((res) => res.data);

      this.loggerService.log(
        JSON.stringify({
          message:
            'saveRandomGeneratedVoice: Received response from create voice',
          data: resp,
        }),
      );

      this.loggerService.log(
        JSON.stringify({
          message: 'saveRandomGeneratedVoice: End of function',
        }),
      );

      return resp;
    } catch (error: any) {
      this.loggerService.error(
        JSON.stringify({
          message: 'saveRandomGeneratedVoice: Error occurred',
          error: error.message,
          response: error.response?.data,
        }),
      );
      throw new Error(error.message);
    }
  }
}
