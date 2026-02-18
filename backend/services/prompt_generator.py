from __future__ import annotations

import random
from typing import Dict, List

DEFAULT_CATEGORIES = ["technical", "artistic", "emotional", "sampler", "combo"]


def generate_prompt(difficulty: int, category: str) -> str:
    """Generate a template-based prompt without external AI."""
    
    # Technical prompts (focus on specs)
    technical_templates = [
        "{size} {material} {drum}, {mode}, {era}",
        "{brand} {drum}, {diameter} inch, {processing}",
        "{drum} with {sticks}, {velocity} velocity, {material} shell",
        "{era} {drum}, {diameter}x{height}, {mode}",
    ]
    
    # Artistic prompts (reference songs/artists)
    artistic_templates = [
        "{artist} style {drum}",
        "{drum} like in {song}",
        "{genre} {drum} inspired by {artist}",
        "{era} {genre} {drum} sound",
    ]
    
    # Emotional prompts (descriptive adjectives)
    emotional_templates = [
        "{adjective1} and {adjective2} {drum}",
        "{adjective1} {drum} with {adjective2} character",
        "{adjective1}, {adjective2} {drum}",
    ]
    
    # Sampler-based prompts
    sampler_templates = [
        "{drum} like {sampler} vintage sampler",
        "acoustic {drum} like in {sampler}",
        "{era} {drum} from {sampler} sound",
    ]
    
    # Data pools
    drums = ["kick", "snare", "hihat", "closed hihat", "open hihat", "ride", "crash", "floor tom", "rack tom", "shaker", "tambourine"]
    adjectives = ["punchy", "warm", "crispy", "fuzzy", "tight", "loose", "dry", "wet", "vintage", "modern", "lo-fi", "clear", "muddy", "aggressive", "gentle", "bright", "dark", "fat", "thin"]
    materials = ["birch", "maple", "mahogany", "acrylic", "steel", "bronze", "brass"]
    sizes = ["10 inch", "12 inch", "13 inch", "14 inch", "16 inch", "18 inch", "20 inch", "22 inch", "24 inch"]
    modes = ["center hit", "rim shot", "side stick", "edge hit", "open", "closed"]
    eras = ["60s", "70s", "80s", "90s", "modern", "vintage", "retro"]
    brands = ["Ludwig", "Gretsch", "Pearl", "Tama", "DW", "Yamaha", "Sonor"]
    processing = ["no room", "plate reverb", "spring reverb", "tape saturation", "compressed", "parallel compression", "transient shaped"]
    sticks = ["wooden drumsticks", "brush", "mallet", "hot rod"]
    velocities = ["soft", "medium", "hard", "ghost note"]
    artists = ["John Bonham", "Steve Gadd", "Tony Williams", "Questlove", "J Dilla"]
    songs = ["Billie Jean", "When the Levee Breaks", "Superstition", "In the Air Tonight"]
    genres = ["rock", "jazz", "funk", "hip-hop", "pop", "R&B", "soul"]
    samplers = ["MPC", "SP-404", "Roland TR-808", "Roland TR-909", "Akai S950", "E-mu SP-1200"]
    diameters = ["10", "12", "13", "14", "16", "18", "20", "22"]
    heights = ["5", "5.5", "6", "6.5", "7", "8", "10", "12", "14"]
    
    # Select template based on category
    if category == "technical":
        template = random.choice(technical_templates)
    elif category == "artistic":
        template = random.choice(artistic_templates)
    elif category == "emotional":
        template = random.choice(emotional_templates)
    elif category == "sampler":
        template = random.choice(sampler_templates)
    else:  # combo
        all_templates = technical_templates + artistic_templates + emotional_templates + sampler_templates
        template = random.choice(all_templates)
    
    # Fill template with random values
    prompt = template.format(
        drum=random.choice(drums),
        adjective1=random.choice(adjectives),
        adjective2=random.choice(adjectives),
        material=random.choice(materials),
        size=random.choice(sizes),
        mode=random.choice(modes),
        era=random.choice(eras),
        brand=random.choice(brands),
        diameter=random.choice(diameters),
        height=random.choice(heights),
        processing=random.choice(processing),
        sticks=random.choice(sticks),
        velocity=random.choice(velocities),
        artist=random.choice(artists),
        song=random.choice(songs),
        genre=random.choice(genres),
        sampler=random.choice(samplers)
    )
    
    return prompt


def generate_prompts(count: int = 100) -> List[Dict[str, any]]:
    """Generate a batch of varied prompts across difficulties and categories."""
    prompts: List[Dict[str, any]] = []
    
    for _ in range(count):
        # Random difficulty and category
        difficulty = random.randint(1, 10)
        category = random.choice(DEFAULT_CATEGORIES)
        
        prompts.append({
            "text": generate_prompt(difficulty, category),
            "difficulty": difficulty,
            "category": category,
            "expected_parameters": None
        })
    
    return prompts

