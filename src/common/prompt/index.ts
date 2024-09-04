export const generateSummaryForDiagnosedResultOfTheAudio = (data: any) => `
        Given the following data:

        ${JSON.stringify(data, null, 2)}

        Generate a summary object with the following structure:

        {
        "summary": {
            "speech": "Summarize speech data, including percentage and events",
            "noise_quality": "Summarize noise score data, including average and distribution highlights",
            "voice_quality": "Summarize quality score data, including average, distribution highlights, and worst segment. For example: This score shows how good the overall quality is. A score of [quality_score_average * 10]% means the quality is okay but could be better."
        }
        }

        Generate a concise summary for each field based on the provided data. 

        Note: Return only the summary object as valid JSON.
`;

export const generateDetailedInfoOnLoudness = (
  loudness: object,
  platform: string,
) => {
  return `
    Analyze the following audio loudness data:
    Loudness: ${JSON.stringify(loudness)}

    Loudness Profile:
    | Platform/Service      | Ideal Loudness Level | Minimum Loudness  | Max Volume Peaks |
    |-----------------------|----------------------|-------------------|------------------|
    | ATSC A/85 TV Standard | Quiet TV audio at -22 | Minimum -26      | Peaks up to -2   |
    | EBU R128 TV Standard  | Quiet TV audio at -22.5 | Minimum -23.5  | Peaks up to -1   |
    | Amazon                | Medium audio at -13  | Minimum -15       | Peaks up to -1   |
    | Apple                 | Medium audio at -15  | Minimum -17       | Peaks up to -1   |
    | Facebook              | Medium audio at -15  | Minimum -17       | Peaks up to -1   |
    | Pandora               | Medium audio at -13  | Minimum -15       | Peaks up to -1   |
    | Spotify               | Medium audio at -13  | Minimum -15       | Peaks up to -1   |
    | SoundCloud            | Medium audio at -13  | Minimum -15       | Peaks up to -1   |
    | Vimeo                 | Medium audio at -15  | Minimum -17       | Peaks up to -1   |
    | YouTube               | Louder audio at -12  | Minimum -14       | Peaks up to -1   |
    | Laptop Playback       | Balanced audio at -14 | Minimum -18      | Peaks up to -1   |
    | Mobile Playback       | Balanced audio at -15 | Minimum -17      | Peaks up to -1   |

    User Input: ${platform}
    Task: Compare the given loudness values to the ideal profile for ${platform}. Provide a brief assessment (2-3 sentences) of how well the audio meets ${platform}'s standards. Include one key recommendation to optimize the audio for ${platform}. Keep the response concise and focused on the most important aspects for ${platform} optimization.
    `;
};

export const generateIdealLoudnessObjectForPlatform = (
  loudness: object,
  platform: string,
) => {
  return `
    Analyze the following audio loudness data:
    ${loudness}

    Loudness Profile:
        | Platform/Service      | Ideal Loudness Level | Minimum Loudness  | Max Volume Peaks |
        |-----------------------|----------------------|-------------------|------------------|
        | ATSC A/85 TV Standard | Quiet TV audio at -22 | Minimum -26      | Peaks up to -2   |
        | EBU R128 TV Standard  | Quiet TV audio at -22.5 | Minimum -23.5  | Peaks up to -1   |
        | Amazon                | Medium audio at -13  | Minimum -15       | Peaks up to -1   |
        | Apple                 | Medium audio at -15  | Minimum -17       | Peaks up to -1   |
        | Facebook              | Medium audio at -15  | Minimum -17       | Peaks up to -1   |
        | Pandora               | Medium audio at -13  | Minimum -15       | Peaks up to -1   |
        | Spotify               | Medium audio at -13  | Minimum -15       | Peaks up to -1   |
        | SoundCloud            | Medium audio at -13  | Minimum -15       | Peaks up to -1   |
        | Vimeo                 | Medium audio at -15  | Minimum -17       | Peaks up to -1   |
        | YouTube               | Louder audio at -12  | Minimum -14       | Peaks up to -1   |
        | Laptop Playback       | Balanced audio at -14 | Minimum -18      | Peaks up to -1   |
        | Mobile Playback       | Balanced audio at -15 | Minimum -17      | Peaks up to -1   |

    User Input: ${platform}

    Generate a JSON object with the following structure, filling in the values based on the given audio data and the profile for the ${platform}:
    {
      "loudness": {
        "target_level": [Platform's ideal loudness level],
        "peak_limit": [Platform's max volume peak],
        "peak_reference": [Use "true_peak" if provided in audio data, otherwise "sample"]
      }
    }
`;
};

export const modifyImageEditPrompt = (prompt: string) => `
Given the following image and user prompt, create an optimized prompt for an InPainting model:

User Prompt: ${prompt}

Instructions:
1. Analyze the image and user prompt.
2. Create a new, optimized prompt that combines relevant details from both.
3. Focus on clear, concise, and visually descriptive language.
4. Emphasize key visual elements and actions.
5. Remove any unnecessary or redundant words.
6. Ensure the prompt is suitable for guiding an InPainting model's output.

Provide only the optimized prompt as your response, without any additional explanation or commentary.

Optimized Prompt:
`;

export const optimizeImageGenerationPrompt = (prompt: string) => `
Original Prompt: ${prompt}

Enhance and optimize the above prompt for an image generation model, following these guidelines:
1. Expand on key visual elements, adding specific details about appearance, style, and atmosphere.
2. Include clear descriptions of lighting, color scheme, and composition.
3. Specify any particular art style or technique that would suit the image (e.g., photorealistic, oil painting, digital art).
4. Add relevant details about the setting, time period, or context if applicable.
5. Incorporate sensory details to make the image more vivid (textures, mood, etc.).
6. Ensure the prompt is coherent and focuses on a clear central subject or scene.
7. Use precise and evocative language to inspire a high-quality, stunning image.
8. Keep the optimized prompt concise yet comprehensive, typically within 2-3 sentences.

Provide only the optimized prompt as your response, without any additional explanation or commentary.
`;

export const analyzeShortFormContentInTheVideo = (
  srt: string,
  totalNumberVideo: number = 1,
  duration: number = 60,
) => `
You are tasked with analyzing an SRT format transcription of a longer video to identify compelling segments for short-form content. Your goal is to select segments that can stand alone as engaging, shareable content without requiring additional context from the full video.

Here is the SRT transcription of the video:
<srt>
  ${srt}
</srt>

Parameters for this task:
- Total number of segments to identify: ${totalNumberVideo}
- Maximum duration for each segment: ${duration} seconds

When selecting segments, focus on the following criteria:
1. Complete, self-contained ideas or concepts
2. Highly engaging and attention-grabbing content
3. Minimal context required for understanding
4. Key insights, surprising facts, or emotionally resonant moments

For each identified segment, provide the following information in JSON format:
1. Start timestamp
2. End timestamp
3. Actual duration of the segment (in seconds)
4. A catchy, scroll-stopping title (max 60 characters)
5. A concise explanation of why this segment is ideal for short-form content
6. A brief summary of the segment's content (2-3 sentences)

Additional guidelines:
- Ensure there is no overlap between suggested segments
- Distribute selections across different parts of the video for variety
- Segments can be shorter than the maximum duration if it results in more impactful content
- Craft titles that are both catchy and accurately represent the segment's content
- In the explanation, focus on why the segment would be engaging and shareable
- In the summary, provide enough context for someone to understand the segment without watching the full video

Provide the output in valid JSON format as per this structure:
{
  "video_segments": [
    {
      "segment_number": 1,
      "start_time": "00:02:15,000",
      "end_time": "00:03:10,000",
      "duration": 55,
      "title": "The 10-Second Hack to Boost Your Productivity",
      "explanation": "This segment presents a quick, actionable tip that viewers can immediately apply, making it highly engaging and shareable.",
      "summary": "The speaker introduces a simple technique to improve focus: the '2-minute rule'. If a task takes less than 2 minutes, do it immediately instead of procrastinating. This small change can significantly increase daily productivity."
    }
  ],
  "total_segments": ${totalNumberVideo},
  "max_duration": ${duration}
}

Remember, the goal is to identify truly standalone, engaging segments that work well as short-form content without requiring additional context. Prioritize segments that can capture and maintain viewer attention quickly.
`;

export const generateContextualShortFormContent = (
  srt: string,
  totalNumberVideo: number = 1,
  duration: number = 60,
) => `
Analyze the provided SRT format transcription to create ${totalNumberVideo} piece(s) of short-form content, each not exceeding ${duration} seconds in total duration. Your task is to identify the most engaging and informative segment(s), with the option to include context from other parts of the video if it enhances understanding or engagement.

Here is the SRT transcription of the video:
<srt>
  ${srt}
</srt>

Guidelines:
1. Identify the primary segment(s) that form(s) the core of your short-form content.
2. If necessary, include brief segments from other parts of the video that provide crucial context or significantly enhance the primary segment's impact.
3. Ensure the total duration of all selected segments combined does not exceed ${duration} seconds for each piece of short-form content.
4. Focus on creating content that is:
   - Engaging and attention-grabbing
   - Informative or emotionally resonant
   - Coherent and understandable as a standalone piece
5. You may select non-contiguous segments if they combine to create a more compelling short-form content.
6. The segments in the output must be ordered chronologically based on their appearance in the original video, regardless of their importance to the short-form content.

Provide the output in valid JSON format as per this structure:
{
  "video_segments": [
    {
      "title": "Catchy, Descriptive Title (max 60 characters)",
      "duration": 58,
      "explanation": "A brief explanation of why this content is engaging and how the different segments (if multiple) work together",
      "summary": "A concise summary of the content (2-3 sentences)",
      "segments": [
        {
          "start_time": "00:02:10,000",
          "end_time": "00:02:23,000",
          "duration": 13,
          "context": "Provides necessary background information"
        },
        {
          "start_time": "00:05:30,000",
          "end_time": "00:06:15,000",
          "duration": 45,
          "context": "Primary segment containing the main content"
        }
      ]
    }
  ],
  "total_short_form_content": ${totalNumberVideo}
}

Notes:
- The "segments" array should contain at least one segment, but may include multiple if context from different parts of the video is necessary.
- Ensure that the sum of all segment durations does not exceed the maximum allowed duration for each piece of short-form content.
- If only one segment is needed, simply include that single segment in the array.
- The "context" field for each segment should briefly explain its role in the overall short-form content.
- The segments in the array MUST be ordered chronologically based on their appearance in the original video.

Remember, the goal is to create the most engaging and informative short-form content possible within the given time constraint, even if it requires combining non-contiguous parts of the video. However, always present these parts in the order they appear in the original video. Create ${totalNumberVideo} piece(s) of short-form content as specified.
`;
