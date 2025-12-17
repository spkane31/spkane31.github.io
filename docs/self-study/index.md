---
layout: page
title: Self Study
---

<p class="message">
  These blog posts are tracking my self directed learnings. I have long been interested in the data science, AI, machine learning, and applied mathematics work so these are my attempts to learn these topics from textbooks / public resources.
</p>

## Posts

{% assign self_study_posts = site.posts | where: "category", "self-study" | sort: 'date' | reverse %}
{% for post in self_study_posts %}
  <div class="post-item">
    <h3><a href="{{ post.url | relative_url }}">{{ post.title }}</a></h3>
    <span class="post-date">{{ post.date | date_to_string }}</span>
    {% if post.excerpt %}
      <p>{{ post.excerpt }}</p>
    {% endif %}
  </div>
{% endfor %}
