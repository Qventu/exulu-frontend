import type { Article } from "../types"

export const mockArticles: Article[] = [
  {
    id: "1",
    title: "The Future of Machine Learning in Enterprise Applications",
    excerpt:
      "How machine learning is transforming business operations and decision-making processes across industries.",
    content:
      "Machine learning technologies are rapidly changing how enterprises operate, from automating routine tasks to providing deep insights from complex data. This article explores the latest trends in enterprise ML applications, including predictive maintenance, customer behavior analysis, and supply chain optimization. We also discuss the challenges of implementing ML at scale and strategies for overcoming them.",
    category: "AI & ML",
    date: "Mar 15, 2025",
    readTime: 8,
    imageUrl: "/placeholder.svg?height=400&width=600",
    keywords: ["machine learning", "enterprise", "AI", "automation", "predictive analytics"],
    vector: [0.2, 0.8, 0.3, 0.1, 0.9],
  },
  {
    id: "2",
    title: "Sustainable Tech: How Green Computing is Reshaping Data Centers",
    excerpt:
      "Exploring the innovations in energy-efficient computing and their impact on reducing the carbon footprint of modern data centers.",
    content:
      "As climate concerns grow, the tech industry is increasingly focused on reducing its environmental impact. This article examines the latest innovations in green computing, from energy-efficient hardware to renewable power sources for data centers. We look at how companies like Google, Microsoft, and Amazon are implementing sustainable practices and the economic benefits they're realizing alongside environmental gains.",
    category: "Climate Tech",
    date: "Mar 10, 2025",
    readTime: 6,
    imageUrl: "/placeholder.svg?height=400&width=600",
    keywords: ["green computing", "sustainability", "data centers", "renewable energy", "climate tech"],
    vector: [0.1, 0.2, 0.9, 0.7, 0.3],
  },
  {
    id: "3",
    title: "The Rise of Remote Work Tools: Beyond Video Conferencing",
    excerpt:
      "A comprehensive look at the evolving ecosystem of remote work technologies that are enabling distributed teams to collaborate effectively.",
    content:
      "Remote work has evolved far beyond simple video calls. This article explores the rich ecosystem of tools that enable truly distributed teams, from asynchronous communication platforms to virtual office environments that recreate the spontaneity of in-person collaboration. We examine how companies are combining these tools to create effective remote work stacks and the impact on productivity, culture, and work-life balance.",
    category: "Productivity",
    date: "Mar 5, 2025",
    readTime: 7,
    imageUrl: "/placeholder.svg?height=400&width=600",
    keywords: ["remote work", "collaboration tools", "distributed teams", "virtual office", "productivity"],
    vector: [0.5, 0.1, 0.2, 0.8, 0.4],
  },
  {
    id: "4",
    title: "Quantum Computing: Practical Applications on the Horizon",
    excerpt:
      "As quantum computers reach new milestones, we explore the real-world problems they're beginning to solve and what's coming next.",
    content:
      "Quantum computing is moving from theoretical promise to practical reality. This article examines the current state of quantum hardware and the early applications showing real promise, from drug discovery to materials science and cryptography. We interview leading researchers about the timeline for quantum advantage in various industries and how companies can prepare to leverage this revolutionary technology.",
    category: "Quantum Tech",
    date: "Feb 28, 2025",
    readTime: 9,
    imageUrl: "/placeholder.svg?height=400&width=600",
    keywords: ["quantum computing", "quantum applications", "drug discovery", "materials science", "cryptography"],
    vector: [0.7, 0.6, 0.1, 0.2, 0.5],
  },
  {
    id: "5",
    title: "The Evolution of No-Code Development Platforms",
    excerpt:
      "How no-code tools are democratizing software development and enabling a new generation of citizen developers.",
    content:
      "No-code development platforms are transforming who can build software and how it gets built. This article traces the evolution of these tools from simple website builders to sophisticated platforms capable of creating complex business applications. We explore how enterprises are using no-code to clear IT backlogs, empower domain experts, and accelerate digital transformation initiatives.",
    category: "Development",
    date: "Feb 20, 2025",
    readTime: 6,
    imageUrl: "/placeholder.svg?height=400&width=600",
    keywords: ["no-code", "low-code", "citizen developers", "digital transformation", "software development"],
    vector: [0.3, 0.4, 0.6, 0.2, 0.1],
  },
  {
    id: "6",
    title: "Blockchain Beyond Cryptocurrency: Enterprise Use Cases",
    excerpt:
      "Exploring how blockchain technology is being applied to solve real business problems outside the financial sector.",
    content:
      "While blockchain is best known for powering cryptocurrencies, its potential applications extend far beyond finance. This article examines how enterprises are using blockchain for supply chain transparency, digital identity verification, intellectual property protection, and more. We analyze successful implementations and the lessons learned from early adopters about where blockchain adds genuine value versus where traditional databases remain superior.",
    category: "Blockchain",
    date: "Feb 15, 2025",
    readTime: 8,
    imageUrl: "/placeholder.svg?height=400&width=600",
    keywords: ["blockchain", "enterprise", "supply chain", "digital identity", "intellectual property"],
    vector: [0.4, 0.3, 0.5, 0.6, 0.2],
  },
  {
    id: "7",
    title: "The State of Edge Computing: Infrastructure and Applications",
    excerpt:
      "How processing data closer to its source is enabling new applications and improving performance for existing ones.",
    content:
      "Edge computing is redefining the architecture of the internet by moving processing power closer to data sources. This article explores the current state of edge infrastructure and the applications it enables, from IoT deployments to content delivery and real-time analytics. We discuss the technical challenges of managing distributed computing resources and the emerging standards and platforms aiming to simplify edge development.",
    category: "Infrastructure",
    date: "Feb 10, 2025",
    readTime: 7,
    imageUrl: "/placeholder.svg?height=400&width=600",
    keywords: ["edge computing", "IoT", "distributed systems", "real-time analytics", "infrastructure"],
    vector: [0.6, 0.5, 0.4, 0.3, 0.7],
  },
  {
    id: "8",
    title: "Augmented Reality in Enterprise Training and Support",
    excerpt: "How AR technologies are revolutionizing how companies train employees and provide technical support.",
    content:
      "Augmented reality is moving beyond consumer applications to transform enterprise training and support. This article examines how companies are using AR to create immersive training experiences, provide remote expert assistance, and overlay contextual information in industrial settings. We analyze the ROI of these implementations and the technical and organizational challenges of deploying AR at scale.",
    category: "AR & VR",
    date: "Feb 5, 2025",
    readTime: 6,
    imageUrl: "/placeholder.svg?height=400&width=600",
    keywords: ["augmented reality", "AR", "enterprise training", "remote support", "immersive learning"],
    vector: [0.8, 0.7, 0.6, 0.4, 0.1],
  },
  {
    id: "9",
    title: "The Privacy-First Internet: Technologies and Business Models",
    excerpt:
      "As privacy regulations tighten and consumer awareness grows, we explore the technologies enabling a more private online experience.",
    content:
      "Privacy is becoming a central concern for internet users and regulators alike. This article explores the technologies enabling a more private online experience, from zero-knowledge proofs and homomorphic encryption to decentralized identity systems. We examine how businesses are adapting their data practices and developing new privacy-preserving business models that align commercial interests with user privacy.",
    category: "Privacy & Security",
    date: "Jan 30, 2025",
    readTime: 8,
    imageUrl: "/placeholder.svg?height=400&width=600",
    keywords: ["privacy", "data protection", "encryption", "decentralized identity", "zero-knowledge proofs"],
    vector: [0.9, 0.8, 0.7, 0.5, 0.2],
  },
  {
    id: "10",
    title: "The API Economy: Building Businesses Through Integration",
    excerpt: "How APIs are enabling new business models and creating value through seamless integration of services.",
    content:
      "APIs have evolved from technical interfaces to strategic business assets. This article explores how companies are building entire business models around APIs, from fintech infrastructure to logistics and beyond. We examine the characteristics of successful API products, pricing strategies, developer experience design, and how traditional enterprises are using APIs to participate in digital ecosystems.",
    category: "Business Tech",
    date: "Jan 25, 2025",
    readTime: 7,
    imageUrl: "/placeholder.svg?height=400&width=600",
    keywords: ["API", "integration", "developer experience", "business models", "digital ecosystems"],
    vector: [0.2, 0.9, 0.8, 0.7, 0.6],
  },
]

