# Prepskm Firestore Security Specification

1. **Public Read Collections (`study_materials`, `materials`, `mock_tests`, `questions`, `video_lectures`, `videos`, `sections`, `curriculum`, `mentors`, `live_sessions`, `formula_blitz_scores`, `forumTopics`, `communityChat`)**:
   - Students and guests visiting `prepskm.in` must be able to read study materials, attempt mock tests, watch video lectures, view live mentorship sessions, and check leaderboards.
2. **Student / Aspirant Submissions (`mock_results`, `formula_blitz_scores`, `live_sessions`, `activeCalls`, `forumTopics`, `communityChat`, `directInquiries`, `ownerDirectChats`, `users`, `mentorshipTokens`)**:
   - Students can submit their CBT mock test evaluations (`mock_results`), Formula Blitz high scores (`formula_blitz_scores`), raise hands in live mentorship (`live_sessions`), post doubts in forum/chat, and save their user profile.
3. **Admin Management (`study_materials`, `materials`, `mock_tests`, `questions`, `video_lectures`, `videos`, `sections`, `curriculum`, `mentors`)**:
   - Admin creation, updates, and deletions are validated for structural fields (`title`, `subject`, string bounds).
