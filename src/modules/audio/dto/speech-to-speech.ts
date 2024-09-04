import { ELEVEN_LABS_SPEECH_TO_SPEECH_OUTPUT_FORMAT } from '@/libs/elevenlabs/services/elevenlabs.service';
import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class SpeechToSpeechDTO {
  @IsString()
  @IsNotEmpty()
  voice_id: string;

  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  audio_url: string;

  @IsString()
  @IsOptional()
  @IsEnum(ELEVEN_LABS_SPEECH_TO_SPEECH_OUTPUT_FORMAT)
  @IsNotEmpty()
  output_format: ELEVEN_LABS_SPEECH_TO_SPEECH_OUTPUT_FORMAT =
    ELEVEN_LABS_SPEECH_TO_SPEECH_OUTPUT_FORMAT.MP3_44100_192;
}
