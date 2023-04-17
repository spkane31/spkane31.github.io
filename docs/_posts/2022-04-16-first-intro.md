---
layout: post
title: RSBD Rankings Intro
---

# Introduction to RSBD Rankings

## Background

RSBD Rankings is a site for quantifying and comparing individual cross country courses. I had this idea back in the summer of 2019 after reading some articles (probably on Letsrun) about TullyRunners, but never finished or published the foundings. If you are familiar with Elixir and Go, the code for my original attempt can be found [here](https://github.com/spkane31/rankings).

Track performances are easily comparable. Outdoor tracks are 400m and indoor tracks have their own set of [conversions](https://www.ustfccca.org/assets/NCAA-Indoor-Track-Size-Conversion-Charts.pdf). On the flip side, cross country courses have no standards. They vary drastically, with some courses being so flat and straight they might as well be on a track, and others like the [NCAA Championship course in 2022](https://www.letsrun.com/news/2021/03/it-will-be-a-bloodbath-are-you-ready-for-the-hardest-ncaa-xc-course-in-recent-memory/) are brutal.

## Tully Runners

Bill Meylan created [Tully Runners](http://www.tullyrunners.com/index.htm) to compare high school cross country courses. He has [two methods](http://www.tullyrunners.com/Data/Articles/artgraph.htm) for analyzing performances statistically. I'll do a brief explanation for the purposes to further them, however I recommend reading Bill's blog, he has great explanations and blog posts on his site. Bill's two methods for evaluating differences in performances are:

1. a graphical representation : compare the "slope" of performances at the same meet. All meets have an (inverted) S-curve when you plot individual performances, and measuring the difference between two curves will give a "correction factor" for a meet.
1. a "reference" runner method : compare how individuals do at different courses over the season.

## RSBD

Bill's site deals with high school performances, but I'm more interested in collegiate performances. There's a few notable differences between high school and collegiate cross country:

* racing season: high schoolers race frequently, some collegiate teams will only race 5-6 times in a season.
* roster sizes: some collegiate teams will only have 10-15 runners, some high school teams have over 100. Larger rosters (and more data points) help draw meaningful conclusions on data points.
* field quality: collegiate fields are the best of the best, high school races have a lower field quality (NOTE: this is not derogatory, I love high school cross country, think it was great for me as a teenager, and think everyone should run if they can break 15 or break 30, go out and have fun!).
* racing tactics: early season races are "rust busters" after a long summer of training, but later meets (conference, regional, and NCAA champs) are where the racing happens. On the high school side, top runners can just run away from competitors. Bill mentions that he does not like using elite runners to compare performances, and I agree with him. However, at the time of writing (2023-04-16) I do not have a working system for minimizing this.
* race distances: collegiates run several distances. Men run 8K, 5 Miles, 10K, and occasionally an oddball 5K or 6K early. Women run 5K or 6K. To account for this, performances are scaled to 8K for men, and 5K for women.

This site uses a slightly different methodology, but similar in nature to the "reference" runner method Bill came up with. Starting with all performances of an athlete in a given season, and measure the difference as the season improves. For example, here's Nico Young's 2022 season:

| Date | Meet | Distance | Time | Scaled Time |
| - | - | - | - | - |
| 2022-9-23 | Cowboy Jamboree | 8K | 23:24 | 23:24 |
| 2022-10-13 | Nuttycombe Invitational | 8K | 23:10 | 23:10 |
| 2022-10-27 | Big Sky Championships | 8K | 22:31.5 | 22:31 |
| 2022-11-10 | Mountain Region Champs | 10K | 28:01.8 | 22:28 |
| 2022-11-18 | NCAA CC Champs | 10K | 28:44 | 23:02 |

This gives 10 differences in a season.

| Meet 1 | Meet 2 | Difference |
| - | - | - |
| Cowboy | Nuttycombe | 14 seconds |
| Cowboy | Big Sky | 53 seconds |
| Cowboy | Mountain Region Champs | 56 seconds |
| Cowboy | NCAA CC Champs | 22 seconds |
| Nuttycombe | Big Sky | 39 seconds |
| Nuttycombe | Mountain Region Champs | 42 seconds |
| Nuttycombe | NCAA CC Champs | 22 seconds |
| Big Sky | Mountain Region Champs | 63 seconds |
| Big Sky | NCAA CC Champs | -31 seconds |
| Mountain Region | NCAA CC Champs | -34 seconds |

<!-- TODO seankane: finish this portion -->

## ELO System

[ELO](https://en.wikipedia.org/wiki/Elo_rating_system#) is a rating system for zero-sum games, most famously it's used by chess. In a cross-country race there are `n * (n-1) / 2` "games", for a race with 100 runners, there are 4950 games to calculate. The zero-sum portion of ELO can be adapted to for use in a cross country race. Here is a rough summary of how the algorithm is adapted:

1. All athletes start with a base rating of 1400.
1. Calculate scoring function for each position
1. Update rankings

### Expected Scores

Standard ELO calculates an expected score for each competitor:

$$ E_a = {1 \over 1 + 10 ^ {R_a - R_b/ 400}} $$
$$ R_a \text{ is the ranking value of competitor A}$$
$$ R_b \text{ is the ranking value of competitor B}$$

Group ELO calculates the expected score for each competitor:

$$ E_a = \sum_{i=1}^{n} {1 \over 1 + 10 ^ {(R_i - R_a / 10)} } $$
$$ \text{where } n \text{ is the number of competitors.} $$
$$ \text{where } R_a \text{ is the ELO rating of competitor A.} $$
$$ \text{where } R_i \text{ is the ELO rating of competitor } i. $$

### Scoring Functions

Scoring Function for standard ELO

$$
S_a =
    \begin{cases}
        1 & \text{if player wins}\\
        0 & \text{if player loses}\\
    \end{cases}
$$

Linear Scoring Function for group ELO

$$ S_a = {N - a \over N (N - 1) / 2} $$

### Calculating New Rankings

Update ELO Ratings after a competition:

$$ R'_a = R_a + K(N-1)(S_a - E_a) $$

where $$ S_a - E_a $$

is the difference between actual performance and expected performance. If a competitor performs better than expected, their respective ELO rating will rise, and vice versa if a competitor performs worse than their expected rating. For each competition, new ELO ratings are calculated for each competitor, with updates used in subsequent races.

### Caveats

There are caveats with the traditional ELO system (which can be found on the Wikipedia page), but with the group system applied to cross country there are other issues. Most importantly, number of competitions, with fewer races there's less data points for ELO ratings to stabilize.
