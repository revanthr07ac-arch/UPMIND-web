-- ==============================================================================
-- UPMIND Database Schema Migration 004: Seed Initial Skills Catalog
-- ==============================================================================

INSERT INTO public.skills (name, category, description)
VALUES
    ('Flutter & Dart', 'Mobile Development', 'Build cross-platform mobile apps for Android and iOS using Flutter and Dart.'),
    ('UI/UX Design', 'Design', 'User experience research, wireframing, prototyping, and modern interface design with Figma.'),
    ('Python Programming', 'Programming', 'Python fundamentals, automation, web backends with FastAPI/Django, and scripting.'),
    ('Graphic Design', 'Design', 'Visual identity, logo design, poster layout, and typography using Adobe tools.'),
    ('Video Editing', 'Video & Audio', 'Cinematic video cutting, color grading, sound design, and pacing using Premiere Pro / DaVinci.'),
    ('Portrait Photography', 'Photography', 'Camera settings, lighting composition, model posing, and photo retouching.'),
    ('JavaScript & TypeScript', 'Web Development', 'Modern frontend and backend JavaScript with ES6+, Node.js, and type safety.'),
    ('Prompt Engineering & AI', 'Artificial Intelligence', 'Crafting effective prompts, fine-tuning workflows, and LLM application design.'),
    ('Data Analysis & SQL', 'Data Science', 'Querying relational databases, exploratory data analysis, and dashboard visualization.'),
    ('Content Writing & Copywriting', 'Writing', 'Engaging storytelling, persuasive copy for landing pages, and educational blogging.'),
    ('Digital Marketing & SEO', 'Marketing', 'Search engine optimization, content strategy, growth analytics, and social campaigns.'),
    ('Music Production', 'Video & Audio', 'Beat making, synth design, recording vocals, and mastering tracks in digital audio workstations.'),
    ('Public Speaking & Communication', 'Personal Growth', 'Presentation skills, stage presence, overcoming nervousness, and clear articulation.'),
    ('Product Management', 'Business', 'User story mapping, sprint planning, roadmapping, and agile product development.')
ON CONFLICT (name) DO UPDATE SET
    category = EXCLUDED.category,
    description = EXCLUDED.description;
