---
title: 'Navigation System for Visually Impaired People'
description: ''
pubDate: '2018-11-16'
heroImage: '../../assets/hero/2020/02/Visually-Impaired1.jpg'
category: 'Things'
---

Two problems blind people often encounter when walking are colliding with obstacles and overshooting or missing completely their intended destinations. Our solution is to combine collision-avoidance measures with navigation guidance systems, using the locations of our users with beacons installed as geology fences at key locations which need high navigation accuracy.

# 1.Executive Summary

Two
problems blind people often encounter when walking are colliding with obstacles
and overshooting or missing completely their intended destinations. Our
solution is to combine collision-avoidance measures with navigation guidance
systems, using the locations of our users with beacons installed as geology fences
at key locations which need high navigation accuracy. As a failsafe,
crowdsourcing maps can be utilized to ensure our users maintain their correct
paths and arrive at their intended destinations. To avoid collisions, the SLAM
system combined with a two-eye depth camera will detect obstacles around our
users and ensure their uneventful safety while using our navigation system.

# 2.Problem Definition

More
than 3.4 million people in the United States are legally blind or at least
visually impaired (having VA of 20/40 or less)[[i]](#_edn1).
Over the next three decades, the adult population with vision impairment and
age-related eye diseases is estimated to double because of the rapidly aging
U.S. population[[ii]](#_edn2).
Additionally, the growing diabetes epidemic as well as other chronic diseases
is projected to contribute to the increase of vision loss in the overall
population.

A
visually impaired person encounters a vast number of difficulties in their
daily life, including problems with identifying people, places, and things;
reading and writing; and description using visual cues. Walking, a process
which relies heavily on identification, is particularly difficult for the
visually impaired person. When walking, people are constantly recognizing
objects and their surrounding environment in order to safely navigate to their
final location. Despite this difficulty, it is nearly impossible to avoid
stepping outside.

Through
interviews with six blind people, we compiled some difficulties commonly faced
by individuals with visual impairments. The principal difficulties faced by
individuals with visual impairments are obstacle avoidance and destination
navigation.

There
are several kinds of obstacle avoidance that blind people would encounter:

-    Avoidance of fixed facilities such as
walls, buildings, and fire hydrants

-    Avoidance of moving obstacles such as
moving cars and pedestrians

There
are also several kinds of geology information estimation blind people have to
do when walking outside:

-    Estimation of destination to map travel
routes that they have arrived at their destination

-    Estimation of traffic conditions to
determine whether or not they can continue walking

Currently,
the two primary methods of obstacle avoidance for individuals with visual impairments
are the white cane[[iii]](#_edn3)
and the guide dog[[iv]](#_edn4).
The white cane detects obstacles which are only immediately imminent within
several steps. This method exerts the lowest financial expenditure and is very
easy to learn and manipulate for the user, but in addition to its short reach,
the white cane can also only detect obstacles which are on or immediately above
the ground.

Guide
dogs are a more efficient method of obstacle avoidance and are a comparatively
recent development. However, because of a shortage of dog trainers coupled with
the high price of procuring and maintaining a guide dog, only about two percent
of people with visual impairments currently utilize guide dogs[[v]](#_edn5).
Even when utilizing a guide dog, individuals with visual impairments still rely
on navigation services such as Google Maps to guide them to and alert them of
their arrival at their intended destinations.

There
are some concepts that could potentially aid individuals with visual
impairments when they are walking outside.

# 3.Concepts for Solving the Problem

After
uncoupling user demands, we can find that the demands for collision avoidance
and demands for navigation are independent of each other, which means that we
can solve those two demands individually.

## 3.1Collison Avoidance

The
key complaint that white cane users have is that the cane does not cover all of
the ground that our users traverse, which means that the users cannot entirely
ensure that they will not collide with any obstacles in their path when
traveling. For this, the function requirement we need to meet are:

-    Determining that our users’ pathways are
safe from obstacles which are collision risks

-    Notifying users of collision risks with
ample time to adjust accordingly

Following
are several concepts that can potentially meet our function requirements.

### 3.1.1SLAM System

Simultaneous
Localization and Mapping, or SLAM for short, is an indoor mapping and
navigation system most commonly used by robotic vacuum cleaners. SLAM hardware
requirements vary and depend on the level of accuracy which users want to
achieve. In our concept, we use a two-eye camera to build the SLAM system. A
two-eye camera has lower accuracy, but it achieves enough accuracy to fulfill
our requirements[[vi]](#_edn6).
Although the traditional lidar+ panoramic camera method would achieve a higher
level of accuracy, the bulk and weight of this camera are not suitable for our
uses.

### 3.1.2Ultrasonic

For
detecting impending obstacles, we can also utilize ultrasonic, the easiest and
most cost-effective option available to us. Ultrasonic can usually detect
obstacles in a 3-5 meter range[[vii]](#_edn7),
but it has a relatively high environmental requirement and is compromised by
inclement weather conditions such as rain or snowfall.

### 3.1.3Artificial Intelligence and Machine learning about obstacles and collision

Artificial
Intelligence is another potential method of obstacle avoidance for our users.
However, the accuracy of AI relies heavily on the AI’s information learned
during its training, and its network requirement will be yet another limitation
for users when using an AI-based collision avoidance system.

### 3.1.4Sound Feedback System

A
well-designed sound system has the potential to give users as much information
as they need and want, and it requires a minimal learning cost expenditure.
However, when using sound to receive navigation information, users might accidentally
ignore or not be able to hear the system’s feedback whether because of
attention or their surrounding environment.

### 3.1.5Vibration Feedback System

The
advantage of vibration is that it will not occupy the user’s eyes and can
provide feedback in real-time. Yet, the information vibration could deliver is
limited.

### 3.1.6Concept Selection

To
select from our possible concepts, we considered the following design
parameters and function requirements:

Function
Requirements:

-    The ability to cover an area large enough
for users (about 2 feet x 6 feet or enough for the next 5 seconds of forward
movement)

-    The ability to detect potential collision
risks with accuracy

Design
Parameters

-    The system should be small so as not to
create additional burden for the user

-    The cost expenditure should be
user-friendly and affordable

From
our FR and DP, we choose two-eye SLAM+ vibration feedback as our collision
avoidance system because of the following reasons:

-    A two-eye depth camera is all we need to
create a basic SLAM system, and a basic SLAM system such as the Intel D415
already fulfills this requirement according to a review by 3d Scan-expert[[viii]](#_edn8)

-    Our SLAM system would be small enough to
conveniently carry

-    The price for the two-eye camera SLAM
system would be around $200-300 USD, which is extremely affordable in
comparison to a guide dog

## 3.2Navigation

As
previously mentioned, the most critical problem with navigation is accuracy or
the lack thereof. Although Google Maps and Maze are able to plan routes and
navigate users to most destinations, they are still unable to guide users to a
small, specific destination such as a bus stop or a specific room indoors. Our
plan is to combine a variety of technologies and methods to improve the
precision and coverage of the navigation capabilities, allowing individuals
with visual impairments to find and verify their final destinations.

### 3.2.1Using Beacons to Locate

Using
beacons in places that are particularly difficult to navigate to, tour users
can interact with our system to determine whether or not they have correctly
navigated to their destination. One downside with this is that if the users are
too far from any beacons, they will experience difficulty with their navigation
guidance and destination arrival. This feature will function more as a method
of verification as opposed to a method of navigation guidance.

### 3.2.2Using a SLAM System to Navigate

We
can use the SLAM system to do real-time mapping and navigation guidance, but it
can only be used indoors and requires that users walk along the borders or
edges of their travel areas. Its application scenarios may be limited.

### 3.2.3Crowdsourcing Detailed Map

In
this concept, we would rely on volunteers to provide detailed information about
critical locations so that users could navigate and guide themselves to their
destinations. However, this method requires a massive amount of volunteers to
collect information about specific areas, and the accuracy of this information
will be dependent on contributions as opposed to preset data.

## 3.2.4Concept Selection

Taking
into consideration that the locations to which our users need navigation guidance
can be located both outdoors and indoors, we chose to use a combination of
beacons, crowdsourced maps, and Google Maps’ route planning function to help
our visually impaired users navigate to and reach their final intended
destinations.

# 4.Proposed Solution

In this section, we will describe the
technology we used and the specifications of our system, then specify the
human-computer interaction and the industrial design considerations.

## 4.1Collision Avoidance

As we discussed in the concepts section, we
would use the two-eye camera to blind a visual SLAM system. We use the depth of
field to estimate the distance between users and moving obstacles such as
pedestrians and cars. In the meanwhile, using GPS evaluation and imagination
comparison, we will be able to mark the fixed objects on the daily routine of
our users, such as walls or fire hydrant. We would use a typical visual SLAM
method to process our images.

In the visual odometry and back-end
optimization part, we use a series of pictures taken by our camera to calculate
and estimate the depth of the field in order to estimate the distance between
users and obstacles.

![](/uploads/2020/02/Visually-Impaired1.jpg)

Figure4.1
Process Procedure of SLAM system

In the loop closure detection part, when
users are walking to places that they have walked before, we could compare the
key frames taken at that moment to the images we took earlier, thereby enabling
us to get a more accurate result about the obstacle recognition.

In this solution, we would use ORB-SLAM
algorithm to finish this process; ORB-SLAM is a developed and open-sourced SLAM
system, got relatively high evaluation in Github.

## 4.2Accuracy Navigation

![](/uploads/2020/02/Visually-Impaired2.jpg)

We
plan to use beacon+ crowdsourcing maps to do this accuracy navigation. The
processes are as follows.

Figure4.2
General Process of users interact with beacons

The typical user scenarios would include:

1.   
Using Google Maps to plan the route

2.   
Using Google Maps +GPS to do overall navigation

3.   
When approaching destinations or public transportation sites that
require higher accuracy, such as a bus pole, our system begins to search
beacons and tells users about the detailed information of the location. In this
situation, GPS would not be accurate enough to guide users to the exact place.

4.   
Once the system is connected to one of the beacons, we could know the
precise spot where our users are located.

5.   
In the meanwhile, the system would describe the detailed information of
the spot users are looking for.

### 4.2.1Beacons

![](/uploads/2020/02/Visually-Impaired3.jpg)

We
would use Bluetooth Low Energy (BLE) as our beacons. To ensure the reliability
of beacons, we have made them as simple as possible. The beacon itself will be
only responsible for sending its serial numbers. We use our system to receive
this information and estimate the location by retrieving its locations by
serial number.

We would install multiple beacons (beacon
groups) around the locations that we would like to provide accurate navigation.
We would use two sources of information that our beacon offers to make the
navigation process smoother.

Figure
4.2.1 Detection Process of Beacons

1.   
Whether the user entered one of our beacons: if users entered one of the
beacons areas we set, we could determine our users’ exact locations.

2.   
The first beacon our users entered: as can be seen in the Figure 4.2, we
will set multiple beacons around our key locations. We could predict users’
next step by estimating the first beacon users step into. For example, if one
user connects to the beacon inside a beacon group near a bus pole first, then
this user must be taking a bus from anywhere else to our location. By this
method, we could verify the route of our users.

## 4.2.2Crowdsourcing Maps

We would provide information about the
locations we mentioned before to ensure that blind people could find the exact
locations even when they are not able to connect to the beacons. This mapping
system would provide detailed information about the key locations blind people
have to locate throughout the whole navigation process. For example, when blind
people approach a bus pole, the system would describe the detailed information
to the user:

-   
This bus stop is a pole

-   
This bus stop is three feet away from the curb

-   
This bus stop is on grass

![](/uploads/2020/02/Visually-Impaired4.jpg)

Overall
processing procedures are as follows.

Figure4.2.2
Process of Crowdsourcing Mapping System

The whole process of our system is a process
wherein volunteers provide information, and blind people receive information.
The function of our system is to filter information for both volunteers and
blind people. The critical feature of this system for volunteers is to ensure
the quality of the data, include the locations that needed to be described, and
determine the way and key facts that should be included in the description. In
the meantime, the key function of this system for blind users is providing correct
information at the correct time. The system would estimate users’ current
location by combining GPS and beacons location information, and deliver
detailed information about current locations to our users.

## 4.3Human-computer Interaction

![](/uploads/2020/02/Visually-Impaired5.jpg)

As
we discussed before, from the aspect of bulk, the main component of our system
is the two-eye camera. As our interaction methods are voice/sound and
vibration, we don’t have to add a monitor or other components that would
involve large volume, so the final volume of our system will still stay small.

Considering that blind people would use our
system or wear our system for the whole day, an ideal solution would integrate
our system with everyday objects used daily by blind people. At last, we
decided to combine our system with glasses.

Figure
4.3 Shape of Our System

# 5.Expected impact

There are 3.4 million blind people in the US.
This system would give them a new way to go out and explore the world.

From the emotional side, the thought that I
have heard most frequently is that blind people want to go out for a walk or to
travel to new places independently. If this system could help them while
walking outside and enable them to feel more empowered and secure in their
environment, this would be the most significant impact that this system could
achieve.

# 6.Feasibility and Marketability

## 6.1Feasibility

From technology side, the technology and
components that we used are all existed.

From manipulation side, the difficulties of
delivering this system to the whole society lay in two aspects:

-   
Beacon installations. As in our system, users would need to interact
with the beacons installed in the destination; the numbers of beacons and their
installation and maintenance would be a potential problem.

-   
Quality of crowdsourcing maps. The coverage of crowdsourcing maps would
require a lot of human resources.

## 6.2Marketability

The key components of our system are two-eye
camera and glasses. Other components of our system, such as voice control part
and beacons connector, can be offered by a standard mobile phone. Thus, the
material cost of the whole system will be no more than 300 USD. This price is much
cheaper than our competitors. Similar products, such as SUNU Band would cost
300USD but can offer obstacle detection function only.

# 7. Appendix

From
my point of view, in the whole process of system design, it’s critical to
define the statement of the problem and to find the real need of users. A
developed definition of the problem will be beneficial in finding the
solutions. The inclusion that comes from logic and data might look correctly,
yet will still be highly possible that this conclusion is not what users need.

Our
original thought was to help blind people solve the problem that tactile pave
being occupied. After decomposing this problem, we find out that this problem
was not the critical problem in blind people’s life when they are walking
outside. So, my problem shifted to helping blind people to design a system that
could help them walk to any destinations they want to.

At
the first beginning, when I was defining the pain-point of blind people going
outside, my thought was to classify and solve those scenarios one by one. From
the logical side, there must be a goal for blind people when they are going
outside. The demand will be solved if we solve that goal. For example, if blind
people want to buy some housing supplies, the purpose of this system can be to
help them to obtain housing supplies but not be guiding them to the groceries.

When
I talked to our real users and tried to understand their demands, I found that
going outside is not just finishing the task blind people have. Blind people
desired to walk on the street, not only because they want to accomplish what
they must do for the living, but also because of emotional need, such as
breathing fresh air, doing things all by themselves without helping.

After
conducted the whole research about the real needs of our users, I changed my
problem statement aging into helping blind people to arrive at any destinations
they want. After I choose the right topic, the whole process of narrowing down
problem scope become much easier.

I would
like to allow any portion of this term paper and milestone presentations be
used for the teaching material in the future of this class

---

[[i]](#_ednref1) National
Federation of the Blind, (2017). “Statistical Facts about Blindness in the
United States”. From https://nfb.org/blindness-statistics

[[ii]](#_ednref2) World Health
Organization, (2018). “Global data on visual impairment”. From https://www.who.int/news-room/fact-sheets/detail/blindness-and-visual-impairment

[[iii]](#_ednref3) Wikipedia, “White cane”,
(2018).  https://en.wikipedia.org/wiki/White\_cane

[[iv]](#_ednref4) Guiding Eyes for the
Blind. (2017). "General Information." From https://www.guidingeyes.org/about-us/general-information/.

[[v]](#_ednref5) Guiding Eyes for the
Blind. (2017). "General Information." From https://www.guidingeyes.org/about-us/general-information/.

[[vi]](#_ednref6) Overall information
about SLAM. (2018). From https://www.leiphone.com/news/201605/5etiwlnkWnx7x0zb.html

[[vii]](#_ednref7) Wikipedia, “Ultrasonic”
(2018). From https://en.wikipedia.org/wiki/Ultrasound

[[viii]](#_ednref8)  3DScanexpert, “3d scan sensor shootout realsense d415 vs sr300 vs
orbbec astras” (2018). From https://3dscanexpert.com/3d-scan-sensor-shootout-realsense-d415-vs-sr300-vs-orbbec-astra-s/
