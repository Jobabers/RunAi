-- Run before deploying the progress analysis endpoint.
alter type public.ai_trigger_type add value if not exists 'progress_review';
