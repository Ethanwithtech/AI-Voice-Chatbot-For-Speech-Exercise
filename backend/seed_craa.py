"""
Seed script: creates 3 sample CRAA exercises.
Run from the backend/ directory:
    python seed_craa.py
"""
import sys
import os

sys.path.insert(0, os.path.dirname(__file__))

from app.database import get_db, Exercise, User

CRAA_EXERCISES = [
    {
        "title": "Mindfulness in the Workplace",
        "description": "Listen to an argument about mindfulness at work. Summarise the key points and provide a critical response.",
        "difficulty": "medium",
        "topic_context": (
            "In recent years, many companies have introduced mindfulness programmes "
            "for their employees, claiming they improve focus, reduce stress, and "
            "boost overall productivity. These programmes range from meditation apps "
            "to dedicated quiet rooms and company-led yoga sessions."
        ),
        "key_claim": "Mindfulness programmes in the workplace significantly improve employee productivity and well-being.",
        "argument_text": (
            "Good morning. Today I want to talk about why mindfulness programmes are essential for modern workplaces. "
            "Research from Harvard Business Review shows that mindfulness training reduces employee stress by up to 28% "
            "and improves focus by 20%. When employees are less stressed, they make fewer mistakes, collaborate more "
            "effectively, and stay with the company longer, reducing costly turnover. Companies like Google, Apple, and "
            "Aetna have reported measurable returns on investment from their mindfulness programmes. Aetna alone saved "
            "approximately $2,000 per employee in healthcare costs. Furthermore, mindfulness helps workers manage "
            "the increasing demands of digital communication and multitasking. In an age of constant distraction, "
            "teaching employees to focus deliberately is not a luxury — it is a competitive advantage. "
            "Therefore, I firmly believe that organisations that invest in mindfulness are investing in their future."
        ),
        "preparation_time": 120,
        "response_time": 120,
        "video_url": "https://www.youtube.com/watch?v=jDpPhMES7Bc",
    },
    {
        "title": "Virtual Influencers: Should They Be Regulated?",
        "description": "Listen to an argument about regulating virtual influencers. Summarise and critically respond.",
        "difficulty": "medium",
        "topic_context": (
            "Virtual influencers are computer-generated social media personalities that promote products "
            "and lifestyles to millions of followers. Unlike human influencers, they never age, never "
            "make controversial statements accidentally, and can be available 24/7. Brands increasingly "
            "prefer them for their controllability and consistent image."
        ),
        "key_claim": "Virtual influencers should be regulated because they deceive audiences and undermine authentic human connection.",
        "argument_text": (
            "The rise of virtual influencers poses a serious ethical challenge that demands regulatory action. "
            "When a CGI character promotes a skincare product, most followers — many of them teenagers — "
            "do not realise they are being marketed to by a piece of software. This lack of transparency "
            "is fundamentally deceptive. Unlike human influencers, virtual influencers cannot genuinely "
            "experience the products they endorse. They will never actually use the moisturiser they promote "
            "or wear the trainers they advertise. This creates false authenticity that exploits the trust "
            "audiences place in influencer culture. Moreover, virtual influencers present an impossible and "
            "artificially constructed ideal of beauty and lifestyle, contributing to unrealistic expectations "
            "among young audiences already struggling with social comparison. The fashion industry was regulated "
            "to require disclosure of photoshopping; the influencer industry needs similar rules. "
            "We must require clear labelling that an influencer is AI-generated, just as we label advertisements. "
            "Without regulation, we risk allowing corporations to exploit human psychology at scale with zero accountability."
        ),
        "preparation_time": 120,
        "response_time": 120,
        "video_url": "https://www.youtube.com/watch?v=PKCPyq-6n9Q",
    },
    {
        "title": "Lab-Grown Meat: Should We Promote It?",
        "description": "Mock test: Listen to an argument on lab-grown meat and deliver a critical response under timed conditions.",
        "difficulty": "hard",
        "topic_context": (
            "Lab-grown meat, also known as cultivated or cell-cultured meat, is produced by growing animal "
            "cells in a laboratory setting without slaughtering animals. Proponents argue it could revolutionise "
            "food systems by dramatically reducing the environmental impact of meat production, while critics "
            "raise concerns about safety, cost, and cultural acceptance."
        ),
        "key_claim": "Governments and food organisations should actively promote lab-grown meat as a sustainable alternative to conventional animal farming.",
        "argument_text": (
            "The case for promoting lab-grown meat is both urgent and compelling. Conventional animal agriculture "
            "accounts for approximately 14.5% of global greenhouse gas emissions, consumes vast amounts of land "
            "and freshwater, and is a leading driver of biodiversity loss. Lab-grown meat, by contrast, requires "
            "up to 96% less land, 96% less water, and produces significantly fewer emissions than traditional "
            "beef production. As global demand for meat rises — particularly in developing economies — we cannot "
            "meet that demand sustainably through conventional farming alone. Lab-grown meat offers a path to "
            "satisfy protein needs without ecological catastrophe. Critics worry about safety, but cultivated "
            "meat is produced under sterile laboratory conditions, potentially making it safer than conventional "
            "meat which carries risks of contamination and antibiotic-resistant bacteria. The technology is "
            "advancing rapidly: production costs have fallen from $300,000 per kilogram in 2013 to under $10 "
            "today. With government support and public investment, we can accelerate this trajectory. "
            "The question is not whether we should promote lab-grown meat, but whether we can afford not to."
        ),
        "preparation_time": 120,
        "response_time": 120,
        "video_url": "https://www.youtube.com/watch?v=2gxSIVa6uqY",
    },
]


def main():
    db = get_db()
    try:
        # Find admin user to assign as teacher
        admin = db.query(User).filter(User.role.in_(["admin", "teacher"])).first()
        if not admin:
            print("ERROR: No admin or teacher user found. Run the app first to create the admin user.")
            sys.exit(1)

        # Check if CRAA exercises already exist
        existing = db.query(Exercise).filter(Exercise.exercise_type == "craa").count()
        if existing > 0:
            print(f"Skipping seed — {existing} CRAA exercise(s) already exist.")
            return

        created = 0
        for data in CRAA_EXERCISES:
            ex = Exercise(
                teacher_id=admin.id,
                title=data["title"],
                description=data["description"],
                difficulty=data["difficulty"],
                exercise_type="craa",
                topic_context=data["topic_context"],
                key_claim=data["key_claim"],
                argument_text=data["argument_text"],
                preparation_time=data["preparation_time"],
                response_time=data["response_time"],
                video_url=data.get("video_url"),
            )
            db.add(ex)
            created += 1

        db.commit()
        print(f"Created {created} CRAA exercises")
        for data in CRAA_EXERCISES:
            print(f"  - {data['title']} ({data['difficulty']})")

    finally:
        db.close()


if __name__ == "__main__":
    main()
