from pathlib import Path

from app.rules import RuleEngine


def test_rule_engine_flags_deposit_and_preserves_quote(sample_extraction):
    engine = RuleEngine(Path(__file__).parents[1] / "rules")
    hits = engine.evaluate(sample_extraction)
    assert len(hits) == 1
    assert hits[0].severity == "high"
    assert hits[0].quote == "The security deposit is INR 50,000."


def test_rule_engine_does_not_flag_deposit_at_limit(sample_extraction):
    sample_extraction.amounts[1].value = 40000
    engine = RuleEngine(Path(__file__).parents[1] / "rules")
    assert engine.evaluate(sample_extraction) == []
