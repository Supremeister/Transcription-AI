import os
import sys
import unittest
from pathlib import Path


os.environ["GIGAAM_SKIP_MODEL_LOAD"] = "1"
sys.path.insert(0, str(Path(__file__).resolve().parent))

import gigaam_service as service


class GigaAMServiceTests(unittest.TestCase):
    def test_speaker_options(self):
        self.assertEqual(service._speaker_options("2"), {"num_speakers": 2})
        self.assertEqual(
            service._speaker_options("auto"),
            {"min_speakers": 1, "max_speakers": 6},
        )
        self.assertEqual(
            service._speaker_options("4+"),
            {"min_speakers": 4, "max_speakers": 8},
        )

    def test_word_assignment_uses_maximum_overlap(self):
        turns = [
            {"start": 0.0, "end": 1.0, "raw_speaker": "A"},
            {"start": 1.0, "end": 2.0, "raw_speaker": "B"},
        ]
        label, _ = service._create_speaker_mapper(turns)
        words = [
            {"text": "первое", "start": 0.2, "end": 0.8},
            {"text": "второе", "start": 0.9, "end": 1.7},
        ]
        assigned = service._assign_words(words, turns, label)
        self.assertEqual(
            [word["speaker"] for word in assigned],
            ["Собеседник 1", "Собеседник 2"],
        )

    def test_distant_word_uses_nearest_known_speaker(self):
        turns = [
            {"start": 0.0, "end": 1.0, "raw_speaker": "A"},
            {"start": 5.0, "end": 6.0, "raw_speaker": "B"},
        ]
        self.assertEqual(service._best_speaker(2.5, 2.8, turns), "A")

    def test_utterance_merge_keeps_every_word(self):
        words = [
            {
                "text": "один",
                "start": 0.0,
                "end": 0.2,
                "speaker": "Собеседник 1",
            },
            {
                "text": "два",
                "start": 0.3,
                "end": 0.5,
                "speaker": "Собеседник 1",
            },
            {
                "text": "три",
                "start": 0.6,
                "end": 0.8,
                "speaker": "Собеседник 2",
            },
        ]
        utterances = service._build_utterances(words)
        flattened = [
            word["text"]
            for utterance in utterances
            for word in utterance["words"]
        ]
        self.assertEqual(flattened, ["один", "два", "три"])
        self.assertEqual(len(utterances), 2)

    def test_punctuation_label_preserves_words_and_changes_only_case_and_suffix(self):
        self.assertEqual(
            service._apply_punctuation_label("михаил", "UPPER_COMMA"),
            "Михаил,",
        )
        self.assertEqual(
            service._apply_punctuation_label("цель", "LOWER_TIRE"),
            "цель —",
        )
        self.assertEqual(
            service._apply_punctuation_label("рост", "LOWER_PERIOD"),
            "рост.",
        )

    def test_joiner_turns_enclitic_dash_into_hyphen(self):
        self.assertEqual(
            service._join_word_texts(
                [
                    {"text": "какую —"},
                    {"text": "то,"},
                    {"text": "идею."},
                ]
            ),
            "какую-то, идею.",
        )

    def test_boundaries_capitalize_and_close_speaker_turns(self):
        words = [
            {
                "text": "добрый",
                "start": 0.0,
                "end": 0.3,
                "speaker": "Собеседник 1",
            },
            {
                "text": "день",
                "start": 0.4,
                "end": 0.7,
                "speaker": "Собеседник 1",
            },
            {
                "text": "привет",
                "start": 0.8,
                "end": 1.1,
                "speaker": "Собеседник 2",
            },
        ]
        normalized = service._ensure_utterance_boundaries(words)
        self.assertEqual(
            [word["text"] for word in normalized],
            ["Добрый", "день.", "Привет."],
        )

    def test_empty_tokens_do_not_create_empty_utterances(self):
        words = [
            {"text": " ", "start": 0.0, "end": 0.1},
            {"text": ".", "start": 0.1, "end": 0.2},
            {"text": "слово.", "start": 0.2, "end": 0.5},
        ]
        utterances = service._build_utterances(words)
        self.assertEqual(len(utterances), 1)
        self.assertEqual(utterances[0]["text"], "слово.")

    def test_overlap_detection(self):
        turns = [
            {"start": 0.0, "end": 2.0, "raw_speaker": "A"},
            {"start": 1.0, "end": 1.6, "raw_speaker": "B"},
        ]
        label, _ = service._create_speaker_mapper(turns)
        overlaps = service._extract_overlaps(turns, label)
        self.assertEqual(
            overlaps,
            [
                {
                    "start": 1.0,
                    "end": 1.6,
                    "speakers": ["Собеседник 1", "Собеседник 2"],
                }
            ],
        )

    def test_triple_overlap_is_one_interval_with_all_speakers(self):
        turns = [
            {"start": 0.0, "end": 3.0, "raw_speaker": "A"},
            {"start": 1.0, "end": 2.5, "raw_speaker": "B"},
            {"start": 1.5, "end": 2.0, "raw_speaker": "C"},
        ]
        label, _ = service._create_speaker_mapper(turns)
        overlaps = service._extract_overlaps(turns, label)
        self.assertEqual(
            overlaps,
            [
                {
                    "start": 1.0,
                    "end": 1.5,
                    "speakers": ["Собеседник 1", "Собеседник 2"],
                },
                {
                    "start": 1.5,
                    "end": 2.0,
                    "speakers": [
                        "Собеседник 1",
                        "Собеседник 2",
                        "Собеседник 3",
                    ],
                },
                {
                    "start": 2.0,
                    "end": 2.5,
                    "speakers": ["Собеседник 1", "Собеседник 2"],
                },
            ],
        )

    def test_short_overlap_does_not_mark_a_long_utterance(self):
        utterances = [
            {
                "start": 0.0,
                "end": 16.0,
                "speaker": "Собеседник 1",
                "text": "Длинная реплика.",
                "words": [],
            }
        ]
        service._mark_overlaps(
            utterances,
            [
                {
                    "start": 4.0,
                    "end": 4.6,
                    "speakers": ["Собеседник 1", "Собеседник 2"],
                }
            ],
        )
        self.assertFalse(utterances[0]["has_overlap"])
        self.assertEqual(utterances[0]["overlap_seconds"], 0.6)

    def test_substantial_overlap_is_marked_with_duration(self):
        utterances = [
            {
                "start": 0.0,
                "end": 6.0,
                "speaker": "Собеседник 1",
                "text": "Реплика.",
                "words": [],
            }
        ]
        service._mark_overlaps(
            utterances,
            [
                {
                    "start": 2.0,
                    "end": 3.0,
                    "speakers": ["Собеседник 1", "Собеседник 2"],
                }
            ],
        )
        self.assertTrue(utterances[0]["has_overlap"])
        self.assertEqual(utterances[0]["overlap_seconds"], 1.0)


if __name__ == "__main__":
    unittest.main()
