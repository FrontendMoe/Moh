import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import {
	multiParser,
	FormFile,
} from 'https://deno.land/x/multiparser@0.114.0/mod.ts';
import { createReadStream } from 'https://deno.land/std@0.153.0/io/mod.ts';

import { Configuration, OpenAIApi } from 'https://cdn.skypack.dev/openai';
import { Readable } from 'https://deno.land/std@0.85.0/node/stream.ts';

console.log(`Function "browser-with-cors" up and running!`);
const corsHeaders = {
	'Access-Control-Allow-Origin': '*',
	'Access-Control-Allow-Headers':
		'authorization, x-client-info, apikey, content-type',
};
const configuration = new Configuration({
	apiKey: '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',
});

const openai = new OpenAIApi(configuration);

serve(async (req) => {
	async function transcribeAudio(data) {
		const audioBlob = new Blob([data.content.buffer], {
			type: data.contentType,
		});

		const fileDescriptor = await Deno.open(audioBlob.stream().getReader());
		const file = new Deno.File(fileDescriptor);
		const stream = new ReadableStream({
			start(controller) {
				const reader = file.readable.getReader();
				reader.read().then(function process({ value, done }) {
					if (done) {
						controller.close();
						return;
					}
					controller.enqueue(value);
					return reader.read().then(process);
				});
			},
		});

		const resp = await openai.createTranslation(stream, 'whisper-1');
		return resp.data.text;
	}

	// This is needed if you're planning to invoke your function from a browser.
	if (req.method === 'OPTIONS') {
		return new Response('ok', { headers: corsHeaders });
	}
	try {
		const form = await multiParser(req);
		const data = {
			message: `Hello ${form.fields.query}! `,
		};
		// const file = form.files.audio;
		// const script = await transcribeAudio(file);
		return new Response(
			JSON.stringify({
				data: data,
				script: await transcribeAudio(form.files.audio),
			}),
			{
				headers: { ...corsHeaders, 'Content-Type': 'application/json' },
				status: 200,
			}
		);
	} catch (error) {
		return new Response(JSON.stringify({ error: error.message }), {
			headers: { ...corsHeaders, 'Content-Type': 'application/json' },
			status: 400,
		});
	}
});
