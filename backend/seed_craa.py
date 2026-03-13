"""
Seed script: Create sample CRAA exercises based on HKBU UE1 Module 4.
Run: python -m backend.seed_craa  (from project root)
Or:  cd backend && python seed_craa.py
"""
import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__)))

from app.database import init_db, get_db, Exercise, User

EXERCISES = [
    {
        "title": "Mindfulness in the Workplace",
        "description": "Listen to Lillian's argument about how mindfulness improves employees' productivity. Summarise her main points and present a counterargument challenging her claim.",
        "difficulty": "medium",
        "exercise_type": "craa",
        "topic_context": "Since the late 2010s—especially after the pandemic—mindfulness has become a common practice in schools, clinics, and workplaces. Basically, it's about paying attention to your body, thoughts, and feelings in the present moment, on purpose and without judgement. Many people appreciate how accessible it is with short-guided sessions delivered through apps or brief classes at work, but now people are starting to wonder about how effective it really is in large organisations.",
        "key_claim": "Mindfulness programmes should be implemented in workplaces because mindfulness significantly improves employees' productivity by helping them remain focussed on their tasks.",
        "argument_text": """[Narration] Since the late 2010s—especially after the pandemic—mindfulness has become a common practice in schools, clinics, and workplaces. Basically, it's about paying attention to your body, thoughts, and feelings in the present moment, on purpose and without judgement. Many people appreciate how accessible it is with short-guided sessions delivered through apps or brief classes at work, but now people are starting to wonder about how effective it really is in large organisations. Nonetheless, during a group discussion with her classmates, Lillian argues that mindfulness significantly improves employees' productivity. Here's what she said:

[Lillian's claim] One key reason mindfulness increases employees' productivity is that it helps them remain focussed on their tasks. Findings from systematic reviews have shown that mindfulness is associated with a decrease in stress caused by distractions and overthinking. This decrease can then lead to gains in thinking ability, motivation, and attention, as well as executive functioning in the workplace. In one specific case, a company that offered brief daily mindfulness sessions found that employees reported fewer interruptions and completed routine tasks more quickly with fewer errors. This doesn't surprise me because when workers notice their mind wandering and gently bring it back, they waste less time ruminating and switch back to the task sooner. Besides this, mindfulness practice can be done in short sessions between meetings, so employees can reset their attention without leaving their desks. With something like deadline pressure, even after a one-minute breathing exercise, a person might feel calmer and prioritise better. This suggests that the improved focus and self-regulation from mindfulness can lead to faster task completion, higher-quality output, and more efficient teamwork.""",
        "video_url": "https://www.youtube.com/watch?v=jDpPhMES7Bc&t=2s",
        "preparation_time": 120,
        "response_time": 120,
    },
    {
        "title": "Virtual Influencers: Should They Be Regulated?",
        "description": "Listen to the argument about virtual influencers in marketing. Summarise the speaker's position on regulating virtual influencers and present a counterargument.",
        "difficulty": "medium",
        "exercise_type": "craa",
        "topic_context": "Virtual influencers are online personas brought to life through computer-generated imagery (CGI) that employ anthropomorphism to come across eerily human-like. It is claimed that virtual influencers generate three times more engagement with brands than their human counterparts. The most prominent virtual influencer is Lil Miquela, who has gained about 2.5 million followers. However, concerns have been raised about consumer protection, authenticity, and transparency.",
        "key_claim": "Virtual influencers should be strictly regulated because they pose a significant danger to consumers due to a lack of authenticity—their product endorsements are by definition ingenuine and fabricated, as they cannot exercise independent judgement or try products like humans can.",
        "argument_text": """Social media influencers play a significant role in today's online advertising campaigns. They are independent third-party endorsers who leverage their social media pages to provide targeted recommendations about the goods or services of other enterprises. Recently, some companies have been turning away from human influencers due to their high costs and unpredictability.

A new type of influencer has emerged: virtual influencers—online personas brought to life through computer-generated imagery. It is claimed that virtual influencers generate three times more engagement with brands than their human counterparts. The most prominent virtual influencer is Lil Miquela, a musician and arts student that has gained about 2.5 million followers.

The speaker argues that virtual influencers should be strictly regulated because they pose a significant danger to consumers due to a lack of authenticity. Their product endorsements are by definition ingenuine and fabricated, as virtual influencers cannot exercise an independent judgement like humans can, and they lack the physical senses necessary to try on clothing, feel the texture of makeup, or perceive the fragrance of a scent. Moreover, a virtual influencer showcasing clothing may not accurately depict how the garments would appear on a real person. Brands dictate the product endorsement that virtual influencers convey, while their message is portrayed as based on their own experience. 42 percent of Gen Z and millennials are unable to distinguish real from unreal online personalities in absence of proper disclosure.""",
        "video_url": "https://www.youtube.com/watch?v=PKCPyq-6n9Q&t=4s",
        "preparation_time": 120,
        "response_time": 120,
    },
    {
        "title": "Lab-Grown Meat: Should We Promote It?",
        "description": "This is a mock test exercise. Listen to the argument about whether we should further promote lab-grown meat, then present a summary and counterargument within 2 minutes.",
        "difficulty": "hard",
        "exercise_type": "craa",
        "topic_context": "Lab-grown meat, also known as cultured meat, is produced by cultivating animal cells in a laboratory rather than raising and slaughtering animals. Proponents argue it could address environmental concerns, animal welfare issues, and food security challenges. However, critics raise questions about its safety, cost, taste, and the potential impact on traditional farming communities.",
        "key_claim": "We should further promote lab-grown meat because it offers a sustainable solution to the environmental damage caused by traditional livestock farming, significantly reducing greenhouse gas emissions, land use, and water consumption.",
        "argument_text": """Lab-grown meat has been gaining significant attention as a potential solution to the environmental crisis caused by traditional animal agriculture. The speaker argues that we should further promote lab-grown meat in the future.

The main claim is that lab-grown meat offers a sustainable alternative that can significantly reduce the environmental footprint of meat production. Traditional livestock farming accounts for approximately 14.5% of global greenhouse gas emissions, uses about 70% of agricultural land, and is a major driver of deforestation and water pollution.

Research from the University of Oxford suggests that cultured meat could reduce greenhouse gas emissions by up to 96%, land use by 99%, and water use by 96% compared to conventional beef production. Furthermore, lab-grown meat eliminates the need for antibiotics in animal farming, which contributes to the growing problem of antibiotic resistance.

The speaker also points out that as production technology improves and scales up, the cost of lab-grown meat will continue to decrease—making it accessible to a wider population. In 2013, the first lab-grown burger cost $330,000, but by 2023, some companies have brought the cost down to under $10 per pound. This rapid cost reduction demonstrates the economic viability of the technology.

The underlying reasoning is that if we can produce meat that tastes the same, provides the same nutrition, but with a fraction of the environmental impact, it would be irresponsible not to invest in and promote this technology for the benefit of future generations.""",
        "video_url": "https://www.youtube.com/watch?v=2gxSIVa6uqY&t=1s",
        "preparation_time": 120,
        "response_time": 120,
    },
]


def seed():
    init_db()
    db = get_db()
    try:
        # Find a teacher user to assign exercises to
        teacher = db.query(User).filter(User.role.in_(["teacher", "admin"])).first()
        if not teacher:
            print("No teacher/admin user found. Creating a default teacher...")
            teacher = User(name="Teacher Demo", email="teacher@demo.com", role="teacher", password_hash="")
            db.add(teacher)
            db.commit()
            db.refresh(teacher)

        # Check if exercises already exist
        existing = db.query(Exercise).filter(Exercise.exercise_type == "craa").count()
        if existing > 0:
            print(f"Found {existing} existing CRAA exercises. Skipping seed.")
            return

        for ex_data in EXERCISES:
            ex = Exercise(teacher_id=teacher.id, **ex_data)
            db.add(ex)
            print(f"  Created: {ex_data['title']}")

        db.commit()
        print(f"\nDone! Created {len(EXERCISES)} CRAA exercises assigned to teacher '{teacher.name}' (id={teacher.id})")
    finally:
        db.close()


if __name__ == "__main__":
    seed()
