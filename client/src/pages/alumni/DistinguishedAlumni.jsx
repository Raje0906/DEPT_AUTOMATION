import React, { useState, useMemo } from 'react';

/**
 * Seed data from db/distinguished_alumni.csv & MESCOE official website.
 * Grouped into Computer, Electronics & Telecommunication (E&TC), and Mechanical departments.
 */
const ALUMNI_DATA = [
  {
    "id": 1,
    "name": "Vikram Sukthankar",
    "batch": "2002–03",
    "position": "Vice President at CitiusTech",
    "image": "https://mescoe.mespune.org/wp-content/uploads/2022/09/Vikram-Sukthankar.jpeg",
    "dept": "Computer Engineering",
    "deptCode": "COMP"
  },
  {
    "id": 2,
    "name": "Dhurandhar Amit",
    "batch": "2003–04",
    "position": "Principal Research Staff Member at IBM TJ Watson",
    "image": "https://mescoe.mespune.org/wp-content/uploads/2022/09/Dhurandhar-Amit.jpeg",
    "dept": "Computer Engineering",
    "deptCode": "COMP"
  },
  {
    "id": 3,
    "name": "Farhat Pirzada",
    "batch": "2003–04",
    "position": "Associate Solution Architect at Maharashtra Knowledge Corporation Limited (MKCL)",
    "image": "https://mescoe.mespune.org/wp-content/uploads/2022/09/Farhat-Pirzada.jpeg",
    "dept": "Computer Engineering",
    "deptCode": "COMP"
  },
  {
    "id": 4,
    "name": "Vishvesh Mulay",
    "batch": "2003–04",
    "position": "Director Of Engineering at Upgrade Inc.",
    "image": "https://mescoe.mespune.org/wp-content/uploads/2022/09/Vishvesh-Mulay.jpeg",
    "dept": "Computer Engineering",
    "deptCode": "COMP"
  },
  {
    "id": 5,
    "name": "Darshak Shah",
    "batch": "2004–05",
    "position": "Co-Founder & CEO, Jash Data Sciences",
    "image": "https://mescoe.mespune.org/wp-content/uploads/2022/09/Darshak_Shah.jpeg",
    "dept": "Computer Engineering",
    "deptCode": "COMP"
  },
  {
    "id": 6,
    "name": "Sachin Khot",
    "batch": "2004–05",
    "position": "Co-Founder & CTO, Jash Data Sciences",
    "image": "https://mescoe.mespune.org/wp-content/uploads/2022/09/Sachin-Khot.jpg",
    "dept": "Computer Engineering",
    "deptCode": "COMP"
  },
  {
    "id": 7,
    "name": "Anant Bhardwaj",
    "batch": "2006–07",
    "position": "Founder & CEO at Instabase",
    "image": "https://mescoe.mespune.org/wp-content/uploads/2022/09/Anant-Bhardwaj.png",
    "dept": "Computer Engineering",
    "deptCode": "COMP"
  },
  {
    "id": 8,
    "name": "Aniket Kadu",
    "batch": "2007–08",
    "position": "Software Engineer, Apple",
    "image": "https://mescoe.mespune.org/wp-content/uploads/2022/09/Aniket-Kadu.jpeg",
    "dept": "Computer Engineering",
    "deptCode": "COMP"
  },
  {
    "id": 9,
    "name": "Shehbaz Jaffer",
    "batch": "2009–10",
    "position": "Software Engineer, Google",
    "image": "https://mescoe.mespune.org/wp-content/uploads/2022/09/Shehbaz-Jaffer.jpeg",
    "dept": "Computer Engineering",
    "deptCode": "COMP"
  },
  {
    "id": 10,
    "name": "Ashwani Mantoo",
    "batch": "2009–10",
    "position": "Operations Manager at Mphasis",
    "image": "https://mescoe.mespune.org/wp-content/uploads/2022/09/Ashwani-Mantoo.jpeg",
    "dept": "Computer Engineering",
    "deptCode": "COMP"
  },
  {
    "id": 11,
    "name": "Asloob Qureshi",
    "batch": "2010–11",
    "position": "Sr. Software Development Engineer at Yahoo",
    "image": "https://mescoe.mespune.org/wp-content/uploads/2022/09/Asloob-Qureshi.jpeg",
    "dept": "Computer Engineering",
    "deptCode": "COMP"
  },
  {
    "id": 12,
    "name": "Priyanka Shinde",
    "batch": "2014–15",
    "position": "Security Researcher 2 at Microsoft",
    "image": "https://mescoe.mespune.org/wp-content/uploads/2022/09/Priyanka-Shinde.jpeg",
    "dept": "Computer Engineering",
    "deptCode": "COMP"
  },
  {
    "id": 13,
    "name": "Komal Khatavkar",
    "batch": "2016–17",
    "position": "Cloud Security Engineer at Amazon Web Services (AWS)",
    "image": "https://mescoe.mespune.org/wp-content/uploads/2022/09/Komal-Khatavkar.jpg",
    "dept": "Computer Engineering",
    "deptCode": "COMP"
  },
  {
    "id": 14,
    "name": "Varada Dharmadhikari",
    "batch": "2016–17",
    "position": "Data Analyst at Google",
    "image": "https://mescoe.mespune.org/wp-content/uploads/2022/09/Varada-Dharmadhikari.jpeg",
    "dept": "Computer Engineering",
    "deptCode": "COMP"
  },
  {
    "id": 15,
    "name": "Vrushali Dharmadhikari",
    "batch": "2013–14",
    "position": "Administrative Assistant at Department of Mathematics, Brooklyn, New York",
    "image": "https://mescoe.mespune.org/wp-content/uploads/2022/09/Vrushali-Dharmadhikari.jpg",
    "dept": "Computer Engineering",
    "deptCode": "COMP"
  },
  {
    "id": 16,
    "name": "Tushar Wagh",
    "batch": "2011–12",
    "position": "Leading flagship e-Governance project of Ministry of Corporate Affairs, Government of India for improving ease of doing business rank of India at global level. *UPSC 2015",
    "image": "https://mescoe.mespune.org/wp-content/uploads/2022/09/Tushar-Wagh.jpg",
    "dept": "Electronics & Telecommunication",
    "deptCode": "ENTC"
  },
  {
    "id": 17,
    "name": "Dhanashree Bhat",
    "batch": "2010–11",
    "position": "UX Visual Design Intern at Rexel Holdings USA, Corp. Indianapolis, Indiana Area",
    "image": "https://mescoe.mespune.org/wp-content/uploads/2022/09/Dhanashree-Bhat.jpg",
    "dept": "Electronics & Telecommunication",
    "deptCode": "ENTC"
  },
  {
    "id": 18,
    "name": "Manoj Kalorey",
    "batch": "2012–13",
    "position": "Solution Engineer Big-Data|Azure|Databricks| Tableau|PowerBI|Spark|ADF|Snowflake Bangalore Urban, Karnataka, India",
    "image": "https://mescoe.mespune.org/wp-content/uploads/2022/09/Manoj-Kalorey.jpg",
    "dept": "Electronics & Telecommunication",
    "deptCode": "ENTC"
  },
  {
    "id": 19,
    "name": "Amar Doshi",
    "batch": "2002–03",
    "position": "Vice President of Product, 6Sense (own start up) San Francisco Bay Area, US MS from University of California, San Diego·2005. MBA from University of California, Berkeley -2014",
    "image": "https://mescoe.mespune.org/wp-content/uploads/2022/09/Amar-Doshi.jpg",
    "dept": "Electronics & Telecommunication",
    "deptCode": "ENTC"
  },
  {
    "id": 20,
    "name": "Andrea Pareira",
    "batch": "2006–07",
    "position": "University of Pune Topper",
    "image": "https://mescoe.mespune.org/wp-content/uploads/2022/09/Andrea-Pareira.jpg",
    "dept": "Electronics & Telecommunication",
    "deptCode": "ENTC"
  },
  {
    "id": 21,
    "name": "Zoya Khan",
    "batch": "2010–11",
    "position": "Software Engineer at Cisco",
    "image": "https://mescoe.mespune.org/wp-content/uploads/2022/09/Zoya-Khan.jpg",
    "dept": "Electronics & Telecommunication",
    "deptCode": "ENTC"
  },
  {
    "id": 22,
    "name": "Sulabh chauhan",
    "batch": "2010–11",
    "position": "Student at IIM Shillong",
    "image": "https://mescoe.mespune.org/wp-content/uploads/2022/09/Sulabh-chauhan.jpg",
    "dept": "Electronics & Telecommunication",
    "deptCode": "ENTC"
  },
  {
    "id": 23,
    "name": "Arjun Sachdeva",
    "batch": "2012–13",
    "position": "Long Beach, California, United State",
    "image": "https://mescoe.mespune.org/wp-content/uploads/2022/09/Arjun-Sachdeva.jpg",
    "dept": "Electronics & Telecommunication",
    "deptCode": "ENTC"
  },
  {
    "id": 24,
    "name": "Suraj Sharma",
    "batch": "2012–13",
    "position": "Account Manager at Proximity Worldwide Düsseldorf, North Rhine-Westphalia, Germany",
    "image": "https://mescoe.mespune.org/wp-content/uploads/2022/09/Suraj-Sharma-1.jpg",
    "dept": "Electronics & Telecommunication",
    "deptCode": "ENTC"
  },
  {
    "id": 25,
    "name": "Dhaval Lele",
    "batch": "2013–14",
    "position": "Software Developer New York, United State",
    "image": "https://mescoe.mespune.org/wp-content/uploads/2022/09/Dhaval-Lele.jpg",
    "dept": "Electronics & Telecommunication",
    "deptCode": "ENTC"
  },
  {
    "id": 26,
    "name": "Rohit Guttikonda",
    "batch": "2014–15",
    "position": "Enginner (Labview and TestStand Developer) Brose India automotive system pvt. ltd.",
    "image": "https://mescoe.mespune.org/wp-content/uploads/2022/09/Rohit-Guttikonda.jpg",
    "dept": "Electronics & Telecommunication",
    "deptCode": "ENTC"
  },
  {
    "id": 27,
    "name": "Dr. Shivraj Rathod",
    "batch": "2011–12",
    "position": "Asst Mang|Defence R&D|Bharat Forge Ltd Mumbai, Maharashtra, India",
    "image": "https://mescoe.mespune.org/wp-content/uploads/2022/09/Dr.-Shivraj-Rathod.jpg",
    "dept": "Electronics & Telecommunication",
    "deptCode": "ENTC"
  },
  {
    "id": 28,
    "name": "Vallabh Jagtap",
    "batch": "2012–13",
    "position": "Consultant- EY || Visiting Faculty || Technology ||Analytics || Data visualisation || Dogs || Cricket || Food || D&I",
    "image": "https://mescoe.mespune.org/wp-content/uploads/2022/09/Vallabh-Jagtap.jpg",
    "dept": "Electronics & Telecommunication",
    "deptCode": "ENTC"
  },
  {
    "id": 29,
    "name": "Ravina Teli",
    "batch": "2012–13",
    "position": "Performance Engineer at Apple United State",
    "image": "https://mescoe.mespune.org/wp-content/uploads/2022/09/Ravina-Teli.jpg",
    "dept": "Electronics & Telecommunication",
    "deptCode": "ENTC"
  },
  {
    "id": 30,
    "name": "Atman Mehta",
    "batch": "2011–12",
    "position": "Software Engineer at Google Sunnyvale, California, United States",
    "image": "https://mescoe.mespune.org/wp-content/uploads/2022/09/Atman-Mehta.jpg",
    "dept": "Electronics & Telecommunication",
    "deptCode": "ENTC"
  },
  {
    "id": 31,
    "name": "Rohit Ingle",
    "batch": "2011–12",
    "position": "Software Development Engineer at Amazon Seattle, Washington, United States",
    "image": "https://mescoe.mespune.org/wp-content/uploads/2022/09/Rohit-Ingle.jpg",
    "dept": "Electronics & Telecommunication",
    "deptCode": "ENTC"
  },
  {
    "id": 32,
    "name": "Mohammed Saif M.S Khan",
    "batch": "2013–14",
    "position": "Senior Software Engineer at John Deere India Pvt. Ltd. (JDTCI) Pune, Maharashtra, India",
    "image": "https://mescoe.mespune.org/wp-content/uploads/2022/09/Mohammed-Saif-M.S-Khan.jpg",
    "dept": "Electronics & Telecommunication",
    "deptCode": "ENTC"
  },
  {
    "id": 33,
    "name": "Merin Thomas",
    "batch": "2013–14",
    "position": "Senior Design Engineer at Microchip Technology Inc. Greater Sacramento",
    "image": "https://mescoe.mespune.org/wp-content/uploads/2022/09/Merin-Thomas-1.jpg",
    "dept": "Electronics & Telecommunication",
    "deptCode": "ENTC"
  },
  {
    "id": 34,
    "name": "Dhananjay Choudhari",
    "batch": "2011–12",
    "position": "React | Redux | React Native | Javascript | AngularJs | Web UI developer | Technical Specialist at HCL Technologies India",
    "image": "https://mescoe.mespune.org/wp-content/uploads/2022/09/Dhananjay-Choudhari.jpg",
    "dept": "Electronics & Telecommunication",
    "deptCode": "ENTC"
  },
  {
    "id": 35,
    "name": "Symrin Siqueira (M.Eng)",
    "batch": "2014–15",
    "position": "Software Test Engineer at Nokia Canada",
    "image": "https://mescoe.mespune.org/wp-content/uploads/2022/09/Symrin-Siqueira.jpg",
    "dept": "Electronics & Telecommunication",
    "deptCode": "ENTC"
  },
  {
    "id": 36,
    "name": "Mr. Dhiraj Gurale",
    "batch": null,
    "position": "Successfully cleared Indian Engineering Services Exam and secured all India rank 18 and 1st in State",
    "image": "https://mescoe.mespune.org/wp-content/uploads/2022/09/m12.jpg",
    "dept": "Electronics & Telecommunication",
    "deptCode": "ENTC"
  },
  {
    "id": 37,
    "name": "Mr. Anup Yeole",
    "batch": "2018–19",
    "position": "Selected in Indian postal services",
    "image": "https://mescoe.mespune.org/wp-content/uploads/2022/09/m1.jpg",
    "dept": "Mechanical Engineering",
    "deptCode": "MECH"
  },
  {
    "id": 38,
    "name": "Mr. Mahesh Kokate",
    "batch": "2018–19",
    "position": "Gov. of Maharashtra (BMC)",
    "image": "https://mescoe.mespune.org/wp-content/uploads/2022/09/m2.jpg",
    "dept": "Mechanical Engineering",
    "deptCode": "MECH"
  },
  {
    "id": 39,
    "name": "Mr. Yadnesh Bhavsar",
    "batch": "2018–19",
    "position": "scored 99.88 in MHCET for MBA",
    "image": "https://mescoe.mespune.org/wp-content/uploads/2022/09/m3.jpg",
    "dept": "Mechanical Engineering",
    "deptCode": "MECH"
  },
  {
    "id": 40,
    "name": "Mr. Vishal Kanawade",
    "batch": "2016–15",
    "position": "working in RBI",
    "image": "https://mescoe.mespune.org/wp-content/uploads/2022/09/m4.jpg",
    "dept": "Mechanical Engineering",
    "deptCode": "MECH"
  },
  {
    "id": 41,
    "name": "Mr. C. R. Hariharan Ramkrishna",
    "batch": "2020–21",
    "position": "All India Rank 1 , selected to be Commissioned (class I ) Officer in Indian Air Force for Combat Pilot role.",
    "image": "https://mescoe.mespune.org/wp-content/uploads/2022/09/m6.jpg",
    "dept": "Mechanical Engineering",
    "deptCode": "MECH"
  },
  {
    "id": 42,
    "name": "Sheetal Appasaheb Patil",
    "batch": "2014",
    "position": "Assistant inspector of motor vehicle (RTO)",
    "image": "https://mescoe.mespune.org/wp-content/uploads/2022/10/Sheetal_Appasaheb_Patil.webp",
    "dept": "Mechanical Engineering",
    "deptCode": "MECH"
  },
  {
    "id": 43,
    "name": "Mr. Prathmesh Pawar",
    "batch": "2016–17",
    "position": "Secured 1st Rank In Maharashtra and 3rd Rank in All India as Assistant Commander In Central Armed Police Forces (CAPF),",
    "image": "https://mescoe.mespune.org/wp-content/uploads/2022/09/m5.jpg",
    "dept": "Mechanical Engineering",
    "deptCode": "MECH"
  },
  {
    "id": 44,
    "name": "MR. Ravindra Gawade",
    "batch": "2016",
    "position": "AMVI (RTO)",
    "image": "https://mescoe.mespune.org/wp-content/uploads/2022/10/MR_Ravindra_Gawade.webp",
    "dept": "Mechanical Engineering",
    "deptCode": "MECH"
  },
  {
    "id": 45,
    "name": "Mr. Kunal Hole",
    "batch": "2014",
    "position": "AMVI (RTO)",
    "image": "https://mescoe.mespune.org/wp-content/uploads/2022/10/Mr._Kunal_Hole.webp",
    "dept": "Mechanical Engineering",
    "deptCode": "MECH"
  },
  {
    "id": 46,
    "name": "Mr. Prashant Holkar",
    "batch": "2003",
    "position": "DCP, Mumbai Govt. of Maharashtra",
    "image": "https://mescoe.mespune.org/wp-content/uploads/2022/09/m19.jpg",
    "dept": "Mechanical Engineering",
    "deptCode": "MECH"
  },
  {
    "id": 47,
    "name": "Mr. Ajinkya Satam",
    "batch": "2006–07",
    "position": "HOD Mechanical Engineering Department Rajarambapu Institute of technology- Polytechnic, Pune",
    "image": "https://mescoe.mespune.org/wp-content/uploads/2022/09/m7.jpg",
    "dept": "Mechanical Engineering",
    "deptCode": "MECH"
  },
  {
    "id": 48,
    "name": "Mr. Tushar Pund",
    "batch": null,
    "position": "Technical officer in Indian Air force Pursuing M. Tech",
    "image": "https://mescoe.mespune.org/wp-content/uploads/2022/09/m8.jpg",
    "dept": "Mechanical Engineering",
    "deptCode": "MECH"
  },
  {
    "id": 49,
    "name": "Mr. Adityaraje Pawar",
    "batch": "2013–14",
    "position": "Deputy Commissioner Income Tax - Indian Revenue Service (current posting in Bhopal)",
    "image": "https://mescoe.mespune.org/wp-content/uploads/2022/09/m9.jpg",
    "dept": "Mechanical Engineering",
    "deptCode": "MECH"
  },
  {
    "id": 50,
    "name": "Mr. Gautam Kamble",
    "batch": "2015–16",
    "position": "Selected as Assistant Motor vehicle inspector (AMVI) MPSC 2017",
    "image": "https://mescoe.mespune.org/wp-content/uploads/2022/09/m10.jpg",
    "dept": "Mechanical Engineering",
    "deptCode": "MECH"
  },
  {
    "id": 51,
    "name": "Mr. Shahrukh Maniyar",
    "batch": null,
    "position": "Selected as Assistant Motor vehicle inspector (AMVI) MPSC 2017",
    "image": "https://mescoe.mespune.org/wp-content/uploads/2022/09/m11.jpg",
    "dept": "Mechanical Engineering",
    "deptCode": "MECH"
  },
  {
    "id": 52,
    "name": "Mr. Ganesh Daphal",
    "batch": null,
    "position": "President Award by Hon. President of India Pranab Mukharjee on 19th November 2012 for his contributions in Social Services (NSS Activity)",
    "image": "https://mescoe.mespune.org/wp-content/uploads/2022/09/m13.jpg",
    "dept": "Mechanical Engineering",
    "deptCode": "MECH"
  },
  {
    "id": 53,
    "name": "Vivek Ahuja",
    "batch": "2006–07",
    "position": "Arbun University, Arbun, Alabama",
    "image": "https://mescoe.mespune.org/wp-content/uploads/2022/09/m14.jpg",
    "dept": "Mechanical Engineering",
    "deptCode": "MECH"
  },
  {
    "id": 54,
    "name": "Aakash Pahwa",
    "batch": "2006–07",
    "position": "Started his own company Pahwa Metaltech",
    "image": "https://mescoe.mespune.org/wp-content/uploads/2022/09/m15.jpg",
    "dept": "Mechanical Engineering",
    "deptCode": "MECH"
  },
  {
    "id": 55,
    "name": "Mr. Amol Kshirsagar",
    "batch": "2004",
    "position": "SPoC, FSD & PL valves & manifolds EATON, Aerospace Division 1st rank in 6 semesters from second year to final year bachelor course 1st rank in M. Tech both years",
    "image": "https://mescoe.mespune.org/wp-content/uploads/2022/09/m16.jpg",
    "dept": "Mechanical Engineering",
    "deptCode": "MECH"
  },
  {
    "id": 56,
    "name": "Dr. Prashant Waghmare",
    "batch": "2004",
    "position": "M. Tech -BATU, Lonere PhD, University of Aleberta, US Branch: Mechanical",
    "image": "https://mescoe.mespune.org/wp-content/uploads/2022/09/m17.jpg",
    "dept": "Mechanical Engineering",
    "deptCode": "MECH"
  },
  {
    "id": 57,
    "name": "Dr. Mandar Harshe",
    "batch": "2007",
    "position": "MS, University of Florida, USA, Phd, in Real-time Computing, Robotics and Automation, Mines PARISTECH and INRIA Sophia Antipolis ,France",
    "image": "https://mescoe.mespune.org/wp-content/uploads/2022/09/m18.jpg",
    "dept": "Mechanical Engineering",
    "deptCode": "MECH"
  },
  {
    "id": 58,
    "name": "Mr. Niranjan Kolhe",
    "batch": "2003",
    "position": "Assist. Vice President; Head – Engineering Transparent Energy Systems Pvt. Ltd., Pune First Indian to complete online MS program from University of Washington",
    "image": "https://mescoe.mespune.org/wp-content/uploads/2022/09/m20.jpg",
    "dept": "Mechanical Engineering",
    "deptCode": "MECH"
  },
  {
    "id": 59,
    "name": "Mr. Digambar Harishchandre",
    "batch": "2012",
    "position": "Owner, Harish Solar Solutions, Ahmednagar",
    "image": "https://mescoe.mespune.org/wp-content/uploads/2022/09/m21.jpg",
    "dept": "Mechanical Engineering",
    "deptCode": "MECH"
  },
  {
    "id": 60,
    "name": "Mr. Taizoon Baker",
    "batch": "2006",
    "position": "Executive Director, BAKER GAUGES India Private Limited",
    "image": "https://mescoe.mespune.org/wp-content/uploads/2022/09/m23.jpg",
    "dept": "Mechanical Engineering",
    "deptCode": "MECH"
  },
  {
    "id": 61,
    "name": "Mr. Krishnan Mahalingam",
    "batch": null,
    "position": "Sr. Technical Lead, Siemens GATE 2006 Score: 93.6 percentile University Gold Medalist M. Tech (CAD/CAM) VIT University in 2008 Awarded Best Rookie for the work in Siemens 2010",
    "image": "https://mescoe.mespune.org/wp-content/uploads/2022/09/m24.jpg",
    "dept": "Mechanical Engineering",
    "deptCode": "MECH"
  },
  {
    "id": 62,
    "name": "Mr. Hrishikesh Bhagawat",
    "batch": "2012",
    "position": "Book publication Ceremony “Cricket is Life”",
    "image": "https://mescoe.mespune.org/wp-content/uploads/2022/09/m22.jpg",
    "dept": "Mechanical Engineering",
    "deptCode": "MECH"
  },
  {
    "id": 63,
    "name": "Mr. Akashy Salunke",
    "batch": null,
    "position": "ranked 2nd in Maharashtra AMVI",
    "image": "https://mescoe.mespune.org/wp-content/uploads/2022/09/Akashy-Salunke-our-alumni-ranked-2-in-Maharashtra-AMVI.jpeg",
    "dept": "Mechanical Engineering",
    "deptCode": "MECH"
  },
  {
    "id": 64,
    "name": "Mr. Aman kumar singh",
    "batch": "2017–18",
    "position": "Junior Engineer Indian Railways",
    "image": "https://mescoe.mespune.org/wp-content/uploads/2022/09/Aman-kumar-singh-Junior-Engineer-Indian-Railways.jpg",
    "dept": "Mechanical Engineering",
    "deptCode": "MECH"
  },
  {
    "id": 65,
    "name": "Mr. Pranav Bhuse",
    "batch": null,
    "position": "ranked 11 in OBC and 50 overall in Maharashtra AMVI",
    "image": "https://mescoe.mespune.org/wp-content/uploads/2022/09/Pranav-bhuse-ranked-11-in-OBC-and-50-overall-in-Maharashtra-AMVI-1.jpeg",
    "dept": "Mechanical Engineering",
    "deptCode": "MECH"
  },
  {
    "id": 66,
    "name": "Mr. Amol S. Wagh",
    "batch": "2016",
    "position": "Asst. Loco Pilot (Indian Railway)",
    "image": "https://mescoe.mespune.org/wp-content/uploads/2022/09/Amol-wagh-Assit-loco-pilot-Indian-Railway.jpeg",
    "dept": "Mechanical Engineering",
    "deptCode": "MECH"
  },
  {
    "id": 67,
    "name": "Mr. Vikas Kadam",
    "batch": "2016",
    "position": "India Security Press",
    "image": "https://mescoe.mespune.org/wp-content/uploads/2022/09/Vikas-Kadam-Vikas-Kadam-2016-batch-for-selection-in-India-Security-Press..jpeg",
    "dept": "Mechanical Engineering",
    "deptCode": "MECH"
  }
];

const DEPARTMENTS = [
  { id: 'ALL', label: 'All Departments' },
  { id: 'COMP', label: 'Computer Alumni' },
  { id: 'ENTC', label: 'E&TC Alumni' },
  { id: 'MECH', label: 'Mechanical Alumni' },
];

/** Generate a consistent pair of initials for the avatar background color */
function avatarColor(name) {
  const colors = [
    '#1E2D5A', '#6B2737', '#3B6B47', '#7A6830',
    '#2D5A3D', '#4A3060', '#1A4A6B', '#5A3A1A',
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
}

function initials(name) {
  return name
    .replace(/^(Mr\.|Dr\.|Mrs\.)\s+/i, '')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('');
}

function DeptBadge({ deptCode }) {
  switch (deptCode) {
    case 'COMP':
      return (
        <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-blue-800 bg-blue-50 border border-blue-200 rounded-sm">
          Computer
        </span>
      );
    case 'ENTC':
      return (
        <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-purple-800 bg-purple-50 border border-purple-200 rounded-sm">
          E&amp;TC
        </span>
      );
    case 'MECH':
      return (
        <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-800 bg-amber-50 border border-amber-200 rounded-sm">
          Mechanical
        </span>
      );
    default:
      return null;
  }
}

function AlumniCard({ alumnus }) {
  const [imgLoaded, setImgLoaded] = useState(false);
  const [imgError, setImgError] = useState(false);

  return (
    <div className="panel p-5 flex flex-col items-center text-center gap-3 hover:shadow-md transition-shadow duration-150">
      {/* Alumni Photo Frame */}
      <div className="relative w-24 h-24 rounded-full overflow-hidden border-2 border-white shadow flex-shrink-0 bg-[#0F162E] flex items-center justify-center">
        {!imgError && alumnus.image ? (
          <img
            src={alumnus.image}
            alt={alumnus.name}
            className={`w-full h-full object-cover transition-opacity duration-200 ${
              imgLoaded ? 'opacity-100' : 'opacity-0'
            }`}
            onLoad={() => setImgLoaded(true)}
            onError={() => setImgError(true)}
            loading="lazy"
          />
        ) : null}

        {/* Fallback initials if image fails or while loading */}
        {(!imgLoaded || imgError || !alumnus.image) && (
          <div
            className="absolute inset-0 flex items-center justify-center text-white font-semibold text-lg"
            style={{ backgroundColor: avatarColor(alumnus.name) }}
            aria-hidden="true"
          >
            {initials(alumnus.name)}
          </div>
        )}
      </div>

      {/* Name */}
      <div className="flex-1 min-w-0 w-full">
        <div className="flex items-center justify-center gap-1.5 mb-1.5 flex-wrap">
          <DeptBadge deptCode={alumnus.deptCode} />
          {alumnus.batch ? (
            <span className="px-2 py-0.5 text-[10px] font-semibold text-navy bg-paper border border-rule rounded-sm">
              Batch {alumnus.batch}
            </span>
          ) : null}
        </div>

        <p className="font-semibold text-sm text-ink leading-snug">{alumnus.name}</p>

        {/* Position / Achievement */}
        <p className="mt-2 text-xs text-draft leading-relaxed line-clamp-4">
          {alumnus.position}
        </p>
      </div>
    </div>
  );
}

export default function DistinguishedAlumni() {
  const [activeDept, setActiveDept] = useState('ALL');
  const [search, setSearch] = useState('');

  // Count per department
  const counts = useMemo(() => {
    return {
      ALL: ALUMNI_DATA.length,
      COMP: ALUMNI_DATA.filter((a) => a.deptCode === 'COMP').length,
      ENTC: ALUMNI_DATA.filter((a) => a.deptCode === 'ENTC').length,
      MECH: ALUMNI_DATA.filter((a) => a.deptCode === 'MECH').length,
    };
  }, []);

  const filtered = useMemo(() => {
    return ALUMNI_DATA.filter((alumnus) => {
      const matchesDept = activeDept === 'ALL' || alumnus.deptCode === activeDept;
      if (!matchesDept) return false;

      if (!search.trim()) return true;
      const q = search.toLowerCase();
      return (
        alumnus.name.toLowerCase().includes(q) ||
        (alumnus.batch && alumnus.batch.toLowerCase().includes(q)) ||
        alumnus.position.toLowerCase().includes(q) ||
        alumnus.dept.toLowerCase().includes(q)
      );
    });
  }, [activeDept, search]);

  return (
    <div className="p-8 lg:p-10 w-full max-w-7xl mx-auto">
      {/* Page header */}
      <div className="mb-6 pb-5 border-b border-rule flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <h1 className="font-serif text-3xl lg:text-4xl font-bold text-ink">Distinguished Alumni</h1>
          <p className="text-base text-draft mt-1">
            MES College of Engineering — Departmental Achievements &amp; Recognitions
          </p>
        </div>

        {/* Search input */}
        <div className="relative w-full sm:w-64">
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-draft pointer-events-none"
            fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}
          >
            <path strokeLinecap="round" strokeLinejoin="round"
              d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
          </svg>
          <input
            type="text"
            id="da-search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search alumni, batch, position…"
            className="input-field pl-9"
          />
        </div>
      </div>

      {/* Department Filter Buttons */}
      <div className="flex flex-wrap items-center gap-2 mb-6">
        {DEPARTMENTS.map((dept) => {
          const isActive = activeDept === dept.id;
          return (
            <button
              key={dept.id}
              onClick={() => setActiveDept(dept.id)}
              className={`
                px-4 py-2 text-xs font-semibold rounded-sm border transition-all duration-150 flex items-center gap-2
                ${
                  isActive
                    ? 'bg-navy text-white border-navy shadow-sm'
                    : 'bg-white text-ink border-rule hover:bg-paper hover:border-draft'
                }
              `}
            >
              <span>{dept.label}</span>
              <span
                className={`
                  px-1.5 py-0.2 rounded text-[10px] font-bold
                  ${
                    isActive
                      ? 'bg-white/20 text-white'
                      : 'bg-gray-100 text-draft'
                  }
                `}
              >
                {counts[dept.id]}
              </span>
            </button>
          );
        })}
      </div>

      {/* Count chip */}
      <p className="text-xs text-draft mb-5">
        Showing <span className="font-semibold text-ink">{filtered.length}</span> of {ALUMNI_DATA.length} alumni
        {activeDept !== 'ALL' && (
          <span> in <span className="font-semibold text-navy">{DEPARTMENTS.find(d => d.id === activeDept)?.label}</span></span>
        )}
      </p>

      {/* Card grid */}
      {filtered.length === 0 ? (
        <div className="empty-state">
          <p className="text-sm text-draft">No alumni match the selected department and search query.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map((alumnus) => (
            <AlumniCard key={alumnus.id} alumnus={alumnus} />
          ))}
        </div>
      )}
    </div>
  );
}
